import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createBaselineSearch } from '../baseline/search-session';
import { createOptimizedSearch } from '../optimized/search-session';
import {
  requestSearch,
  SEARCH_DEBOUNCE_MS,
  SEARCH_PASSES,
} from './search-request';
import type { SearchRequest } from './search-request';
import type { SearchSnapshot } from './types';
import { generateMarketRecords } from '../data/generate-market-records';
import { DEFAULT_MARKET_QUERY, selectMarkets } from '../domain/market-query';
const records = generateMarketRecords({ count: 40, seed: 20260911 });
const query = (search: string) => ({ ...DEFAULT_MARKET_QUERY, search });
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('runs identical bounded deterministic work, counts each pass and cleans completion listeners', async () => {
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, 'removeEventListener');
  const calculation = vi.fn();
  const pending = requestSearch(
    records,
    query('market 4'),
    controller.signal,
    calculation,
  );
  expect(calculation).toHaveBeenCalledTimes(SEARCH_PASSES);
  await vi.advanceTimersByTimeAsync(60);
  expect(await pending).toEqual(selectMarkets(records, query('market 4')));
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(vi.getTimerCount()).toBe(0);
});
it('cancels delivery, removes listeners/timers, and skips work for already aborted requests', async () => {
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, 'removeEventListener');
  const calculation = vi.fn();
  const pending = requestSearch(
    records,
    query('x'),
    controller.signal,
    calculation,
  );
  const rejected = expect(pending).rejects.toMatchObject({
    name: 'AbortError',
  });
  controller.abort();
  await rejected;
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(vi.getTimerCount()).toBe(0);
  calculation.mockClear();
  await expect(
    requestSearch(records, query('x'), controller.signal, calculation),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(calculation).not.toHaveBeenCalled();
});
it('baseline issues every keystroke without aborting superseded requests and ignores late results', async () => {
  const snapshots: SearchSnapshot[] = [];
  const session = createBaselineSearch(
    (value) => snapshots.push(value),
    requestSearch,
    () => Date.now(),
  );
  session.update(records, query('m'));
  session.update(records, query('market 4'));
  expect(snapshots.at(-1)?.stats).toMatchObject({
    requestCount: 2,
    calculationCount: 24,
    abortedCount: 0,
  });
  await vi.advanceTimersByTimeAsync(60);
  expect(snapshots.at(-1)?.state).toEqual({
    status: 'success',
    records: selectMarkets(records, query('market 4')),
  });
  await vi.advanceTimersByTimeAsync(340);
  expect(snapshots.at(-1)?.stats).toMatchObject({
    abortedCount: 0,
    staleCount: 1,
  });
  expect(
    snapshots.at(-1)?.stats.completions.map((event) => event.requestId),
  ).toEqual([2, 1]);
  expect(snapshots.at(-1)?.state).toEqual({
    status: 'success',
    records: selectMarkets(records, query('market 4')),
  });
  for (const event of snapshots.at(-1)!.stats.completions)
    expect(event.completedAt).toBeGreaterThanOrEqual(event.startedAt);
  session.dispose();
});
it('optimized debounces rapid input and aborts in-flight work immediately on the next edit', async () => {
  const snapshots: SearchSnapshot[] = [];
  const session = createOptimizedSearch((value) => snapshots.push(value));
  for (const input of ['m', 'ma', 'mar']) {
    session.update(records, query(input));
    await vi.advanceTimersByTimeAsync(20);
  }
  expect(snapshots.at(-1)?.stats.requestCount).toBe(0);
  await vi.advanceTimersByTimeAsync(230);
  expect(snapshots.at(-1)?.stats).toMatchObject({
    requestCount: 1,
    calculationCount: 12,
  });
  session.update(records, query('market 4'));
  await vi.advanceTimersByTimeAsync(0);
  expect(snapshots.at(-1)?.stats.abortedCount).toBe(1);
  expect(snapshots.at(-1)?.state.status).toBe('loading');
  await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS + 60);
  expect(snapshots.at(-1)?.state).toEqual({
    status: 'success',
    records: selectMarkets(records, query('market 4')),
  });
  expect(snapshots.at(-1)?.stats.requestCount).toBe(2);
  session.dispose();
});
for (const [name, create] of [
  ['baseline', createBaselineSearch],
  ['optimized', createOptimizedSearch],
] as const) {
  it(`${name} rejects late success/failure even from a service that ignores AbortSignal`, async () => {
    const pending: {
      resolve: (value: typeof records) => void;
      reject: (error: Error) => void;
      signal: AbortSignal;
    }[] = [];
    const service: SearchRequest = (_, __, signal) =>
      new Promise((resolve, reject) =>
        pending.push({ resolve, reject, signal }),
      );
    const snapshots: SearchSnapshot[] = [];
    const session = create((value) => snapshots.push(value), service);
    session.update(records, query('a'));
    await vi.advanceTimersByTimeAsync(250);
    session.update(records, query('b'));
    // A late success during the optimized debounce window must not become visible.
    pending[0].resolve(records);
    await vi.advanceTimersByTimeAsync(250);
    expect(snapshots.at(-1)?.state.status).toBe('loading');
    session.update(records, query('market 4'));
    await vi.advanceTimersByTimeAsync(250);
    pending[2].resolve(selectMarkets(records, query('market 4')));
    await vi.advanceTimersByTimeAsync(0);
    pending[1].reject(new Error('late failure'));
    await vi.advanceTimersByTimeAsync(0);
    expect(snapshots.at(-1)?.state).toEqual({
      status: 'success',
      records: selectMarkets(records, query('market 4')),
    });
    expect(pending[0].signal.aborted).toBe(name === 'optimized');
    session.dispose();
  });
  it(`${name} exposes current failure, recovers on retry, and disposes pending work`, async () => {
    const snapshots: SearchSnapshot[] = [];
    const service = vi
      .fn<SearchRequest>()
      .mockRejectedValueOnce(new Error('Search failed'))
      .mockImplementation(requestSearch);
    const session = create((value) => snapshots.push(value), service);
    session.update(records, query('market'));
    await vi.advanceTimersByTimeAsync(250);
    expect(snapshots.at(-1)?.state).toEqual({
      status: 'error',
      message: 'Search failed',
    });
    session.update(records, query('market'));
    await vi.advanceTimersByTimeAsync(310);
    expect(snapshots.at(-1)?.state.status).toBe('success');
    session.update(records, query('m'));
    await vi.advanceTimersByTimeAsync(250);
    session.dispose();
    const length = snapshots.length;
    await vi.runAllTimersAsync();
    expect(snapshots).toHaveLength(length);
    expect(vi.getTimerCount()).toBe(0);
  });
}
it('keeps diagnostic history bounded while retaining exact totals', async () => {
  let latest: SearchSnapshot | undefined;
  const session = createBaselineSearch((value) => {
    latest = value;
  });
  for (let i = 0; i < 105; i++) session.update([], query('market'));
  await vi.runAllTimersAsync();
  expect(latest?.stats.requestCount).toBe(105);
  expect(latest?.stats.calculationCount).toBe(105 * SEARCH_PASSES);
  expect(latest?.stats.completions).toHaveLength(100);
  session.dispose();
});
