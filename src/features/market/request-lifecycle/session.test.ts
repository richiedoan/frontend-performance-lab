import { afterEach, expect, it, vi } from 'vitest';
import { generateMarketRecords } from '../data/generate-market-records';
import {
  CACHE_TTL_MS,
  createLifecycleSession,
  requestRecord,
  type Snapshot,
  type Transport,
} from './session';
const records = generateMarketRecords({ seed: 20260911, count: 12 });
afterEach(() => vi.useRealTimers());
for (const optimized of [false, true]) {
  it(`${optimized ? 'optimized' : 'baseline'} deterministic race converges and instruments transport`, async () => {
    vi.useFakeTimers();
    let snapshot: Snapshot;
    const session = createLifecycleSession(optimized, (next) => {
      snapshot = next;
    });
    const run = session.run(records[0], records[1]);
    await vi.advanceTimersByTimeAsync(50);
    expect(snapshot!.record).toEqual(records[1]);
    await vi.advanceTimersByTimeAsync(250);
    expect(snapshot!.record).toEqual(optimized ? records[1] : records[0]);
    await vi.runAllTimersAsync();
    await run;
    expect(snapshot!.status).toBe('success');
    expect(snapshot!.record).toEqual(records[1]);
    expect(snapshot!.events.filter((e) => e.type === 'start')).toHaveLength(
      optimized ? 2 : 5,
    );
    expect(snapshot!.events.filter((e) => e.type === 'abort')).toHaveLength(
      optimized ? 1 : 0,
    );
    expect(
      snapshot!.events.some((e) => e.type === 'apply' && e.version === 1),
    ).toBe(!optimized);
    const again = session.run(records[0], records[1]);
    await vi.runAllTimersAsync();
    await again;
    expect(snapshot!.events.some((e) => e.type === 'cache-hit')).toBe(
      optimized,
    );
    session.dispose();
  });
}
it('expires cache, evicts oldest entry, and bounds diagnostics', async () => {
  vi.useFakeTimers();
  let snapshot: Snapshot;
  const session = createLifecycleSession(true, (next) => {
    snapshot = next;
  });
  async function run(index: number) {
    const promise = session.run(records[0], records[index]);
    await vi.runAllTimersAsync();
    await promise;
  }
  await run(1);
  await vi.advanceTimersByTimeAsync(CACHE_TTL_MS);
  await run(1);
  expect(snapshot!.events.filter((e) => e.type === 'cache-hit')).toHaveLength(
    0,
  );
  for (let i = 2; i <= 9; i++) await run(i);
  const before = snapshot!.events.at(-1)!.at;
  await run(1);
  expect(
    snapshot!.events.filter(
      (e) =>
        e.type === 'start' && e.recordId === records[1].id && e.at >= before,
    ),
  ).not.toHaveLength(0);
  expect(snapshot!.events.length).toBeLessThanOrEqual(80);
  session.dispose();
});
it('guards against a transport ignoring abort and stops publishing after disposal', async () => {
  const pending: {
    resolve: (record: (typeof records)[number]) => void;
    record: (typeof records)[number];
  }[] = [];
  const transport: Transport = (record) =>
    new Promise((resolve) => pending.push({ resolve, record }));
  const publish = vi.fn();
  const session = createLifecycleSession(true, publish, transport);
  const run = session.run(records[0], records[1]);
  pending[1].resolve(records[1]);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  pending[0].resolve(records[0]);
  await run;
  const snapshot = publish.mock.calls.at(-1)![0] as Snapshot;
  expect(snapshot.record).toEqual(records[1]);
  expect(
    snapshot.events.some((e) => e.type === 'apply' && e.version === 1),
  ).toBe(false);
  expect(snapshot.events.some((e) => e.type === 'ignore')).toBe(true);
  const next = session.run(records[2], records[3]);
  session.dispose();
  const calls = publish.mock.calls.length;
  for (const item of pending.slice(2)) item.resolve(item.record);
  await next;
  expect(publish).toHaveBeenCalledTimes(calls);
});
it('transport cancels timers and rejects already aborted signals', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const promise = requestRecord(records[0], 300, controller.signal);
  const assertion = expect(promise).rejects.toMatchObject({
    name: 'AbortError',
  });
  controller.abort();
  await assertion;
  expect(vi.getTimerCount()).toBe(0);
  await expect(
    requestRecord(records[0], 300, controller.signal),
  ).rejects.toMatchObject({ name: 'AbortError' });
});
it('failed batch can retry without retaining failed promises', async () => {
  vi.useFakeTimers();
  let snapshot: Snapshot;
  const transport = vi.fn<Transport>().mockRejectedValue(new Error('fail'));
  const session = createLifecycleSession(
    true,
    (next) => {
      snapshot = next;
    },
    transport,
  );
  await session.run(records[0], records[1]);
  expect(snapshot!.status).toBe('error');
  transport.mockImplementation(requestRecord);
  const retry = session.run(records[0], records[1]);
  await vi.runAllTimersAsync();
  await retry;
  expect(snapshot!.status).toBe('success');
  session.dispose();
});
