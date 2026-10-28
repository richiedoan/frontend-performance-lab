export const layerLimits = {
  requests: 40,
  layers: 32,
  mappedPerSnapshot: 6,
  snapshots: 3,
  requestMs: 1000,
  bytes: 1048576,
  recordBytes: 65536,
};
export function selectAttribution(args: string[]) {
  const flags = args.filter((arg) => arg.startsWith('--attribution='));
  const mode = flags[0]?.slice(14) ?? 'none';
  if (flags.length > 1 || !['none', 'layers'].includes(mode))
    throw new Error('Use --attribution=none|layers once');
  return { mode, args: args.filter((arg) => !flags.includes(arg)) };
}
interface Layer {
  layerId: string;
  backendNodeId?: number;
  width: number;
  height: number;
  drawsContent: boolean;
}
interface Session {
  send(method: string, params?: object): Promise<unknown>;
  on(
    event: 'LayerTree.layerTreeDidChange',
    listener: (value: { layers?: Layer[] }) => void,
  ): unknown;
  on(
    event: 'LayerTree.layerPainted',
    listener: (value: unknown) => void,
  ): unknown;
  removeListener(
    event: 'LayerTree.layerTreeDidChange',
    listener: (value: { layers?: Layer[] }) => void,
  ): unknown;
  removeListener(
    event: 'LayerTree.layerPainted',
    listener: (value: unknown) => void,
  ): unknown;
  detach(): Promise<void>;
}
/** Bounded passive events and three explicit snapshots; never polls a busy renderer. */
export function layerAttribution(
  session: Session,
  persist: (value: unknown) => void,
  limits = layerLimits,
) {
  let requests = 0,
    bytes = 0,
    dropped = 0,
    snapshots = 0,
    paints = 0;
  let halted = false,
    closed = false,
    busy = false;
  let latest:
    { receivedAt: string; layers?: Layer[]; total: number } | undefined;
  const entries: unknown[] = [];
  const save = (kind: string, data: unknown) => {
    if (closed) return;
    const entry = {
      kind,
      timestamp: new Date().toISOString(),
      monotonicMs: performance.now(),
      data,
    };
    const size = Buffer.byteLength(JSON.stringify(entry));
    if (size > limits.recordBytes || bytes + size > limits.bytes - 4096) {
      dropped++;
    } else {
      entries.push(entry);
      bytes += size;
    }
    persist({ limits, requests, bytes, dropped, halted, entries });
  };
  const tree = (value: { layers?: Layer[] }) => {
    const layers = value.layers;
    // Preserve a bounded sample, prioritizing large surfaces, without querying nodes.
    latest = {
      receivedAt: new Date().toISOString(),
      total: layers?.length ?? 0,
      layers: layers
        ? [...layers]
            .sort((a, b) => b.width * b.height - a.width * a.height)
            .slice(0, limits.layers)
        : undefined,
    };
  };
  const painted = (value: unknown) => {
    if (paints++ < 12) save('layerPainted', value);
  };
  async function request(
    method: string,
    params?: object,
    cleanup = false,
  ): Promise<unknown> {
    if (!cleanup && (halted || closed || requests >= limits.requests - 1)) {
      save('request-skipped', {
        method,
        reason: 'halted/closed/request budget',
      });
      return undefined;
    }
    requests++;
    save('request-start', { method, params });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const value = await Promise.race([
        session.send(method, params),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('CDP diagnostic deadline')),
            limits.requestMs,
          );
        }),
      ]);
      save('response', { method, params, value });
      return value;
    } catch (error) {
      halted = true;
      save('request-failure', {
        method,
        params,
        error: String(error),
        status: String(error).includes('deadline')
          ? 'timeout'
          : 'failed-or-unsupported',
      });
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  }
  session.on('LayerTree.layerTreeDidChange', tree);
  session.on('LayerTree.layerPainted', painted);
  return {
    async start() {
      await request('LayerTree.enable');
    },
    async capture(label: string) {
      if (closed || busy || snapshots >= limits.snapshots) {
        save('snapshot-skipped', {
          label,
          reason: 'closed/busy/snapshot budget',
        });
        return;
      }
      snapshots++;
      busy = true;
      paints = 0;
      const snapshot = latest;
      save('tree-snapshot', {
        label,
        snapshot,
        missing: !snapshot?.layers,
        note: 'Latest delivered tree; receivedAt may precede this phase. Sample is not whole tree.',
      });
      try {
        for (const layer of (snapshot?.layers ?? []).slice(
          0,
          limits.mappedPerSnapshot,
        )) {
          if (halted || closed) break;
          await request('LayerTree.compositingReasons', {
            layerId: layer.layerId,
          });
          if (layer.backendNodeId && !halted && !closed)
            await request('DOM.describeNode', {
              backendNodeId: layer.backendNodeId,
              depth: 0,
              pierce: false,
            });
          else
            save('mapping-unavailable', {
              label,
              layerId: layer.layerId,
              backendNodeId: layer.backendNodeId ?? null,
            });
        }
      } finally {
        busy = false;
      }
    },
    async close() {
      if (closed) return;
      session.removeListener('LayerTree.layerTreeDidChange', tree);
      session.removeListener('LayerTree.layerPainted', painted);
      await request('LayerTree.disable', undefined, true);
      // detach is independently bounded; pending CDP responses never gate browser cleanup.
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          session.detach(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error('detach deadline')),
              limits.requestMs,
            );
          }),
        ]);
      } catch (error) {
        save('detach-failure', String(error));
      } finally {
        clearTimeout(timer);
        save('closed', { snapshots, paintEventsSeen: paints });
        closed = true;
      }
    },
  };
}
