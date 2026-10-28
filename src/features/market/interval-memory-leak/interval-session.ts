import type { MarketRecord } from '../data/market-record';
export const INTERVAL_MS = 1000;
export const MAX_TICKS = 20;
export const MAX_RETAINED_RECORDS = 250;
export const MAX_ACTIVE_INTERVALS = 4;
export interface IntervalEvent {
  session: number;
  approach: 'baseline' | 'optimized';
  phase: 'start' | 'tick' | 'unmount' | 'stop' | 'capacity-stop';
  mounted: boolean;
  tick: number;
  records: number;
  totalVolume: number;
  active: number;
}
// Safety budget survives SPA navigation. Entries contain timer handles and scalars,
// never datasets, React callbacks, DOM nodes or cleanup closures.
const active = new Map<
  ReturnType<typeof setInterval>,
  {
    session: number;
    approach: 'baseline' | 'optimized';
    mounted: boolean;
    tick: number;
  }
>();
let sequence = 0;
const marks: string[] = [];
export function markIntervalEvent(event: IntervalEvent) {
  if (typeof performance.mark !== 'function') return;
  const name = `interval-memory:${event.session}:${event.phase}:${event.tick}`;
  performance.mark(name, { detail: event });
  marks.push(name);
  while (marks.length > 100) performance.clearMarks(marks.shift()!);
}
export function startIntervalSession(
  records: readonly MarketRecord[],
  optimized: boolean,
  publish: (event: IntervalEvent) => void,
  observe: (event: IntervalEvent) => void = markIntervalEvent,
) {
  const session = ++sequence;
  let retained: readonly MarketRecord[] | null = records.slice(
    0,
    MAX_RETAINED_RECORDS,
  );
  let notify: typeof publish | null = publish;
  let mounted = true;
  let tick = 0;
  const approach = optimized ? 'optimized' : 'baseline';
  const event = (phase: IntervalEvent['phase']): IntervalEvent => ({
    session,
    approach,
    phase,
    mounted,
    tick,
    records: retained?.length ?? 0,
    totalVolume: retained?.reduce((sum, record) => sum + record.volume, 0) ?? 0,
    active: active.size,
  });
  if (active.size >= MAX_ACTIVE_INTERVALS) {
    const [oldTimer, oldMetadata] = active.entries().next().value!;
    clearInterval(oldTimer);
    active.delete(oldTimer);
    observe({
      ...event('capacity-stop'),
      ...oldMetadata,
      records: 0,
      totalVolume: 0,
    });
  }
  const timer = setInterval(() => {
    tick++;
    const metadata = active.get(timer);
    if (metadata) metadata.tick = tick;
    // This reads the captured snapshot on every refresh, including detached baseline ticks.
    const sample = event('tick');
    observe(sample);
    notify?.(sample);
    if (tick >= MAX_TICKS) stop();
  }, INTERVAL_MS);
  active.set(timer, { session, approach, mounted, tick });
  function stop() {
    clearInterval(timer);
    active.delete(timer);
    retained = null;
    observe(event('stop'));
    notify = null;
  }
  const started = event('start');
  observe(started);
  notify(started);
  return {
    unmount() {
      mounted = false;
      const metadata = active.get(timer);
      if (metadata) metadata.mounted = false;
      notify = null;
      observe(event('unmount'));
      if (optimized) stop();
    },
  };
}
