import type { MarketRecord } from '../data/market-record';
export const MAX_LISTENERS = 8;
export const MAX_LISTENER_RECORDS = 250;
export const LISTENER_EVENTS = {
  baseline: 'market-lab:listener-probe:baseline',
  optimized: 'market-lab:listener-probe:optimized',
} as const;
type Approach = keyof typeof LISTENER_EVENTS;
export interface ListenerSample {
  session: number;
  approach: Approach;
  phase: 'register' | 'dispatch' | 'unmount' | 'remove' | 'limit';
  mounted: boolean;
  records: number;
  volume: number;
  active: number;
}
// Scalars only: the registry must not become an alternative heap root for handlers/data.
const active: Record<Approach, number> = { baseline: 0, optimized: 0 };
let sequence = 0;
let markSequence = 0;
const markNames: string[] = [];
export function markListenerSample(sample: ListenerSample) {
  if (typeof performance.mark !== 'function') return;
  const name = `listener-memory:${sample.session}:${sample.phase}:${++markSequence}`;
  performance.mark(name, { detail: sample });
  markNames.push(name);
  while (markNames.length > 100) performance.clearMarks(markNames.shift()!);
}
export function dispatchListenerProbe(optimized: boolean, reset = false) {
  window.dispatchEvent(
    new CustomEvent(LISTENER_EVENTS[optimized ? 'optimized' : 'baseline'], {
      detail: { reset },
    }),
  );
}
export function startListenerSession(
  records: readonly MarketRecord[],
  optimized: boolean,
  publish: (sample: ListenerSample) => void,
  observe = markListenerSample,
) {
  const approach: Approach = optimized ? 'optimized' : 'baseline';
  const session = ++sequence;
  if (active[approach] >= MAX_LISTENERS) {
    const sample: ListenerSample = {
      session,
      approach,
      phase: 'limit',
      mounted: true,
      records: 0,
      volume: 0,
      active: active[approach],
    };
    observe(sample);
    publish(sample);
    return { unmount() {} };
  }
  let retained: readonly MarketRecord[] | null = records.slice(
    0,
    MAX_LISTENER_RECORDS,
  );
  let notify: typeof publish | null = publish;
  let mounted = true;
  let removed = false;
  const eventName = LISTENER_EVENTS[approach];
  const sample = (phase: ListenerSample['phase']): ListenerSample => ({
    session,
    approach,
    phase,
    mounted,
    records: retained?.length ?? 0,
    volume: retained?.reduce((total, record) => total + record.volume, 0) ?? 0,
    active: active[approach],
  });
  function remove() {
    if (removed) return;
    removed = true;
    window.removeEventListener(eventName, retainedMarketListener, false);
    active[approach]--;
    retained = null;
    const result = sample('remove');
    observe(result);
    notify?.(result);
    notify = null;
  }
  // Named, stable identity for removal and DevTools retainer inspection.
  function retainedMarketListener(event: Event) {
    if (event instanceof CustomEvent && event.detail?.reset === true) {
      remove();
      return;
    }
    const result = sample('dispatch');
    observe(result);
    notify?.(result);
  }
  window.addEventListener(eventName, retainedMarketListener, false);
  active[approach]++;
  const initial = sample('register');
  observe(initial);
  notify(initial);
  return {
    unmount() {
      mounted = false;
      notify = null;
      if (removed) return;
      observe(sample('unmount'));
      if (optimized) remove();
    },
  };
}
