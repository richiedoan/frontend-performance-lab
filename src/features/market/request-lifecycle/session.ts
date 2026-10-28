import type { MarketRecord } from '../data/market-record';
export const CACHE_TTL_MS = 5000;
export const CACHE_MAX_SIZE = 8;
export type Transport = (
  record: MarketRecord,
  delay: number,
  signal: AbortSignal,
) => Promise<MarketRecord>;
export const requestRecord: Transport = (record, delay, signal) => {
  if (signal.aborted)
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve(record);
    }, delay);
    signal.addEventListener('abort', abort, { once: true });
  });
};
export interface LifecycleEvent {
  type:
    | 'start'
    | 'end'
    | 'abort'
    | 'cache-hit'
    | 'deduplicate'
    | 'apply'
    | 'ignore';
  requestId: number;
  version: number;
  recordId: string;
  at: number;
}
export interface Snapshot {
  status: 'idle' | 'running' | 'success' | 'error';
  record: MarketRecord | null;
  appliedVersion: number;
  events: LifecycleEvent[];
}
export function createLifecycleSession(
  optimized: boolean,
  publish: (snapshot: Snapshot) => void,
  transport = requestRecord,
) {
  let disposed = false;
  let busy = false;
  let version = 0;
  let requestId = 0;
  let snapshot: Snapshot = {
    status: 'idle',
    record: null,
    appliedVersion: 0,
    events: [],
  };
  const cache = new Map<
    string,
    { record: MarketRecord; expires: number; requestId: number }
  >();
  const pending = new Map<
    number,
    { key: string; controller: AbortController; promise: Promise<MarketRecord> }
  >();
  const emit = () => {
    if (!disposed) publish({ ...snapshot, events: [...snapshot.events] });
  };
  const event = (
    type: LifecycleEvent['type'],
    id: number,
    v: number,
    recordId: string,
  ) => {
    if (disposed) return;
    snapshot.events = [
      ...snapshot.events.slice(-79),
      { type, requestId: id, version: v, recordId, at: performance.now() },
    ];
    emit();
  };
  async function load(record: MarketRecord, delay: number, v: number) {
    let id: number;
    let controller: AbortController | undefined;
    let promise: Promise<MarketRecord>;
    for (const [key, entry] of cache)
      if (entry.expires <= Date.now()) cache.delete(key);
    const cached = optimized ? cache.get(record.id) : undefined;
    const existing = optimized
      ? [...pending.entries()].find(
          ([, entry]) =>
            entry.key === record.id && !entry.controller.signal.aborted,
        )
      : undefined;
    if (cached) {
      id = cached.requestId;
      event('cache-hit', id, v, record.id);
      promise = Promise.resolve(cached.record);
    } else if (existing) {
      id = existing[0];
      controller = existing[1].controller;
      promise = existing[1].promise;
      event('deduplicate', id, v, record.id);
    } else {
      id = ++requestId;
      controller = new AbortController();
      const signal = controller.signal;
      signal.addEventListener('abort', () => event('abort', id, v, record.id), {
        once: true,
      });
      event('start', id, v, record.id);
      promise = transport(record, delay, signal)
        .then((result) => {
          event('end', id, v, record.id);
          if (optimized && !disposed && !signal.aborted && v === version) {
            cache.delete(record.id);
            cache.set(record.id, {
              record: result,
              expires: Date.now() + CACHE_TTL_MS,
              requestId: id,
            });
            if (cache.size > CACHE_MAX_SIZE)
              cache.delete(cache.keys().next().value!);
          }
          return result;
        })
        .finally(() => pending.delete(id));
      pending.set(id, { key: record.id, controller, promise });
    }
    try {
      const result = await promise;
      if (disposed) return;
      if (optimized && (v !== version || controller?.signal.aborted)) {
        event('ignore', id, v, record.id);
        return;
      }
      snapshot = { ...snapshot, record: result, appliedVersion: v };
      event('apply', id, v, record.id);
    } catch (error) {
      if (
        !disposed &&
        !(error instanceof DOMException && error.name === 'AbortError')
      )
        throw error;
    }
  }
  return {
    async run(oldRecord: MarketRecord, latestRecord: MarketRecord) {
      if (disposed || busy) return;
      busy = true;
      snapshot = { ...snapshot, status: 'running' };
      emit();
      const oldVersion = ++version;
      const old = [
        load(oldRecord, 300, oldVersion),
        load(oldRecord, 300, oldVersion),
      ];
      const latestVersion = ++version;
      if (optimized)
        for (const entry of pending.values()) entry.controller.abort();
      const latest = [
        load(latestRecord, 50, latestVersion),
        load(latestRecord, 50, latestVersion),
      ];
      const results = await Promise.allSettled([...old, ...latest]);
      if (disposed) return;
      try {
        if (results.some((result) => result.status === 'rejected'))
          throw new Error('Request failed');
        // One finite revalidation repairs the deliberately stale baseline result.
        if (!optimized) await load(latestRecord, 50, latestVersion);
        snapshot = { ...snapshot, status: 'success' };
      } catch {
        snapshot = { ...snapshot, status: 'error' };
      }
      busy = false;
      emit();
    },
    dispose() {
      disposed = true;
      if (optimized)
        for (const entry of pending.values()) entry.controller.abort();
      cache.clear();
    },
  };
}
