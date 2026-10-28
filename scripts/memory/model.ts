import { parseScenarioConfig } from '../../src/features/market/config/scenario-config';
export const CYCLES = 10;
// Memory collection uses the full dataset, rather than small E2E fixtures.
export const MEMORY_READINESS_POLICY = {
  id: 'full-dataset-journey-v1',
  navigationTimeoutMs: 90000,
  tableTimeoutMs: 90000,
  actionTimeoutMs: 60000,
  assertionTimeoutMs: 60000,
  collectionTimeoutMs: 1800000,
} as const;
export const GC_FLAG = '--js-flags=--expose-gc';
export function readMemoryConfig(
  env: Readonly<Record<string, string | undefined>>,
) {
  const mode = env.MEMORY_MODE ?? 'dry-run';
  if (!['dry-run', 'test', 'benchmark'].includes(mode))
    throw new Error('MEMORY_MODE must be dry-run, test or benchmark');
  const route = env.MEMORY_ROUTE ?? 'both';
  if (!['baseline', 'optimized', 'both'].includes(route))
    throw new Error('Invalid MEMORY_ROUTE');
  const browser = env.MEMORY_BROWSER ?? 'chromium';
  if (!['chrome', 'chromium'].includes(browser))
    throw new Error('Invalid MEMORY_BROWSER');
  const gc = env.MEMORY_GC ?? 'on';
  if (!['on', 'off'].includes(gc))
    throw new Error('MEMORY_GC must be on or off');
  const cleanupMs = Number(env.MEMORY_CLEANUP_MS ?? '250');
  if (!Number.isInteger(cleanupMs) || cleanupMs < 0 || cleanupMs > 5000)
    throw new Error('cleanup wait must be 0..5000 ms');
  const params = new URLSearchParams({
    scenario: env.MEMORY_SCENARIO ?? 'detached-dom-memory-leak',
    seed: env.MEMORY_SEED ?? '20260911',
    count: env.MEMORY_COUNT ?? '5000',
    delayMs: '0',
  });
  const parsed = parseScenarioConfig(params.toString());
  if (parsed.status === 'invalid') throw new Error(parsed.message);
  if (parsed.config.count < 1)
    throw new Error('Memory journey requires at least one record');
  return {
    mode: mode as 'dry-run' | 'test' | 'benchmark',
    routes: route === 'both' ? ['baseline', 'optimized'] : [route],
    browser,
    forceGc: mode === 'benchmark' && gc === 'on',
    cleanupMs,
    scenario: parsed.config.scenario,
    seed: parsed.config.seed,
    count: parsed.config.count,
    query: params.toString(),
    flags:
      mode === 'benchmark' && gc === 'on'
        ? [GC_FLAG, '--enable-precise-memory-info']
        : [],
  };
}
export type MemoryConfig = ReturnType<typeof readMemoryConfig>;
export type Value =
  | {
      status: 'measured';
      value: number;
      unit: 'bytes' | 'nodes' | 'trees';
      aggregation: 'single';
      sampleCount: 1;
      evidencePath: 'raw-results.json';
    }
  | { status: 'not-available'; reason: string };
export const unavailable = (reason: string): Value => ({
  status: 'not-available',
  reason,
});
export function measured(
  value: number,
  unit: 'bytes' | 'nodes' | 'trees',
): Value {
  if (!Number.isFinite(value) || value < 0)
    throw new Error('Invalid metric value');
  return {
    status: 'measured',
    value,
    unit,
    aggregation: 'single',
    sampleCount: 1,
    evidencePath: 'raw-results.json',
  };
}
export interface Cycle {
  cycle: number;
  startedAt: string;
  endedAt: string;
  status: 'success' | 'failed' | 'dry-run';
  failures: { stage: string; message: string }[];
  gc: 'performed' | 'disabled' | 'failed';
  usedHeap: Value;
  domNodes: Value;
  detachedTrees: Value;
}
export interface Adapter {
  journey(): Promise<void>;
  cleanup(): Promise<void>;
  gc(): Promise<void>;
  heap(): Promise<Value>;
  dom(): Promise<Value>;
  detached(): Promise<Value>;
  errors(): string[];
}
export async function collectCycles(
  config: MemoryConfig,
  adapter: Adapter | null,
  save: (cycle: Cycle) => Promise<void>,
  setupFailure?: string,
) {
  for (let index = 1; index <= CYCLES; index++) {
    const reason =
      config.mode === 'benchmark'
        ? 'Collection did not complete'
        : `No measurements in ${config.mode} mode`;
    const cycle: Cycle = {
      cycle: index,
      startedAt: new Date().toISOString(),
      endedAt: '',
      status: config.mode === 'dry-run' ? 'dry-run' : 'success',
      failures: [],
      gc: 'disabled',
      usedHeap: unavailable(reason),
      domNodes: unavailable(reason),
      detachedTrees: unavailable(reason),
    };
    async function step(stage: string, action: () => Promise<void>) {
      try {
        await action();
      } catch (error) {
        cycle.failures.push({
          stage,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (!adapter && config.mode !== 'dry-run' && !setupFailure)
      setupFailure = 'Browser adapter unavailable';
    if (setupFailure)
      cycle.failures.push({ stage: 'setup', message: setupFailure });
    else if (config.mode !== 'dry-run' && adapter) {
      await step('journey', () => adapter.journey());
      await step('cleanup', () => adapter.cleanup());
      if (config.forceGc)
        await step('gc', async () => {
          cycle.gc = 'failed';
          if (config.mode !== 'benchmark' || !config.flags.includes(GC_FLAG))
            throw new Error(
              'Forced GC requires owned benchmark browser with expose-gc flag',
            );
          await adapter.gc();
          cycle.gc = 'performed';
        });
      if (config.mode === 'benchmark') {
        await step('heap', async () => {
          cycle.usedHeap = await adapter.heap();
        });
        await step('dom', async () => {
          cycle.domNodes = await adapter.dom();
        });
        await step('detached', async () => {
          cycle.detachedTrees = await adapter.detached();
        });
      }
      for (const message of adapter.errors())
        cycle.failures.push({ stage: 'browser', message });
    }
    if (cycle.failures.length) cycle.status = 'failed';
    cycle.endedAt = new Date().toISOString();
    await save(cycle);
  }
}
export interface RawMemoryRun {
  schemaVersion: 1;
  status: 'collecting' | 'complete';
  config: MemoryConfig;
  environment: Record<string, unknown>;
  routes: {
    route: string;
    browser: unknown;
    recordId: string | null;
    failures: string[];
    cycles: Cycle[];
  }[];
}
export function validateRawMemoryRun(raw: RawMemoryRun) {
  if (
    raw.schemaVersion !== 1 ||
    raw.status !== 'complete' ||
    raw.routes.length !== raw.config.routes.length
  )
    throw new Error('Incomplete run');
  const rebuilt = readMemoryConfig({
    MEMORY_MODE: raw.config.mode,
    MEMORY_ROUTE:
      raw.config.routes.length === 2 ? 'both' : raw.config.routes[0],
    MEMORY_BROWSER: raw.config.browser,
    MEMORY_SCENARIO: raw.config.scenario,
    MEMORY_SEED: String(raw.config.seed),
    MEMORY_COUNT: String(raw.config.count),
    MEMORY_CLEANUP_MS: String(raw.config.cleanupMs),
    MEMORY_GC: raw.config.forceGc ? 'on' : 'off',
  });
  if (JSON.stringify(rebuilt) !== JSON.stringify(raw.config))
    throw new Error('Invalid conditions');
  if (
    !raw.environment.node ||
    !raw.environment.viewport ||
    !raw.environment.buildId
  )
    throw new Error('Missing environment');
  raw.routes.forEach((route, index) => {
    if (
      route.route !== raw.config.routes[index] ||
      !route.browser ||
      !Array.isArray(route.failures) ||
      route.cycles.length !== CYCLES
    )
      throw new Error('Missing route/cycles');
    const browser = route.browser as {
      product?: string;
      status?: string;
      reason?: string;
    };
    if (
      !browser.product &&
      !(browser.status === 'not-available' && browser.reason?.trim())
    )
      throw new Error('Missing browser/version');
    route.cycles.forEach((cycle, index) => {
      if (
        cycle.cycle !== index + 1 ||
        !Number.isFinite(Date.parse(cycle.startedAt)) ||
        !Number.isFinite(Date.parse(cycle.endedAt)) ||
        !Array.isArray(cycle.failures) ||
        !['success', 'failed', 'dry-run'].includes(cycle.status)
      )
        throw new Error('Invalid cycle');
      if (cycle.failures.length > 0 !== (cycle.status === 'failed'))
        throw new Error('Unreported failure');
      for (const failure of cycle.failures)
        if (!failure.stage || !failure.message)
          throw new Error('Missing failure details');
      if (
        !['performed', 'disabled', 'failed'].includes(cycle.gc) ||
        (cycle.gc !== 'disabled' && !raw.config.forceGc)
      )
        throw new Error('Invalid GC state');
      if (
        cycle.status === 'success' &&
        raw.config.mode === 'benchmark' &&
        (cycle.usedHeap.status !== 'measured' ||
          cycle.domNodes.status !== 'measured' ||
          (raw.config.forceGc && cycle.gc !== 'performed'))
      )
        throw new Error('Missing successful benchmark data');
      if (raw.config.mode !== 'dry-run' && cycle.status === 'dry-run')
        throw new Error('Invalid cycle mode');
      for (const [key, unit] of [
        ['usedHeap', 'bytes'],
        ['domNodes', 'nodes'],
        ['detachedTrees', 'trees'],
      ] as const) {
        const value = cycle[key];
        if (value.status === 'not-available') {
          if (!value.reason?.trim())
            throw new Error('Missing unavailable reason');
        } else if (
          value.status !== 'measured' ||
          raw.config.mode !== 'benchmark' ||
          !Number.isFinite(value.value) ||
          value.value < 0 ||
          value.unit !== unit ||
          value.aggregation !== 'single' ||
          value.sampleCount !== 1 ||
          value.evidencePath !== 'raw-results.json'
        )
          throw new Error('Invalid measurement');
      }
    });
  });
  return raw;
}
