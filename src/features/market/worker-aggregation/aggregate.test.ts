import { expect, it, vi } from 'vitest';
import { aggregateMarkets } from './aggregate';
import { generateMarketRecords } from '../data/generate-market-records';
import { DEFAULT_MARKET_QUERY } from '../domain/market-query';
import { createBaselineAggregation } from '../baseline/aggregation-session';
import { createOptimizedAggregation } from '../optimized/aggregation-session';
import type {
  AggregationJob,
  AggregationReply,
  AggregationSnapshot,
  WorkerPort,
} from './protocol';
const records = generateMarketRecords({ count: 20, seed: 20260911 });
const input = { records, query: DEFAULT_MARKET_QUERY, passes: 3 };
it('normalizes ordering, preserves input and calculates exact totals', () => {
  const before = structuredClone(records);
  const result = aggregateMarkets(input);
  expect(
    aggregateMarkets({ ...input, records: [...records].reverse() }),
  ).toEqual(result);
  expect(result.categories.reduce((sum, group) => sum + group.count, 0)).toBe(
    20,
  );
  expect(
    result.categories.reduce((sum, group) => sum + group.priceCents, 0),
  ).toBe(
    records.reduce((sum, record) => sum + Math.round(record.price * 100), 0),
  );
  expect(result.categories.reduce((sum, group) => sum + group.volume, 0)).toBe(
    records.reduce((sum, record) => sum + record.volume, 0),
  );
  expect(records).toEqual(before);
  expect(aggregateMarkets({ ...input, passes: 1 }).categories).toEqual(
    result.categories,
  );
});
it('filters deterministically and represents empty input', () => {
  const record = records[19];
  const result = aggregateMarkets({
    ...input,
    query: {
      ...DEFAULT_MARKET_QUERY,
      search: record.name.toUpperCase(),
      filters: { category: record.category, status: record.status },
    },
  });
  expect(result.matchedCount).toBe(1);
  expect(
    result.categories.find((group) => group.category === record.category)
      ?.volume,
  ).toBe(record.volume);
  expect(aggregateMarkets({ ...input, records: [] })).toMatchObject({
    matchedCount: 0,
    checksum: 0,
  });
});
it.each([0, 101, 1.5, NaN, Infinity])('rejects invalid passes %s', (passes) => {
  expect(() => aggregateMarkets({ ...input, passes })).toThrow();
});
it('rejects excessive dataset size', () => {
  expect(() =>
    aggregateMarkets({ ...input, records: Array(10001).fill(records[0]) }),
  ).toThrow();
});
class TestWorker implements WorkerPort {
  onmessage: WorkerPort['onmessage'] = null;
  onerror: WorkerPort['onerror'] = null;
  postMessage = vi.fn<(job: AggregationJob) => void>();
  terminate = vi.fn();
  reply(reply: AggregationReply) {
    this.onmessage?.({ data: reply } as MessageEvent<AggregationReply>);
  }
}
it('direct execution is synchronous and worker transport yields equivalent normalized output', () => {
  let direct: AggregationSnapshot | undefined;
  const baseline = createBaselineAggregation((value) => {
    direct = value;
  });
  baseline.update(input);
  expect(direct?.state.status).toBe('success');
  const worker = new TestWorker();
  let asynchronous: AggregationSnapshot | undefined;
  const optimized = createOptimizedAggregation(
    (value) => {
      asynchronous = value;
    },
    () => worker,
  );
  optimized.update(input);
  expect(asynchronous?.state.status).toBe('running');
  const job = structuredClone(worker.postMessage.mock.calls[0][0]);
  worker.reply({
    version: job.version,
    status: 'success',
    output: aggregateMarkets(job.input),
  });
  expect(asynchronous?.state).toEqual(direct?.state);
  expect(worker.terminate).toHaveBeenCalledTimes(1);
  expect(worker.onmessage).toBeNull();
  baseline.dispose();
  optimized.dispose();
});
it('terminates obsolete jobs and ignores queued messages and errors after replacement/cleanup', () => {
  const workers: TestWorker[] = [];
  const publish = vi.fn();
  const session = createOptimizedAggregation(publish, () => {
    const worker = new TestWorker();
    workers.push(worker);
    return worker;
  });
  session.update(input);
  const oldMessage = workers[0].onmessage!;
  const oldError = workers[0].onerror!;
  session.update({ ...input, passes: 4 });
  expect(workers[0].terminate).toHaveBeenCalledTimes(1);
  const calls = publish.mock.calls.length;
  oldMessage({
    data: { version: 1, status: 'success', output: aggregateMarkets(input) },
  } as MessageEvent<AggregationReply>);
  oldError({} as ErrorEvent);
  expect(publish).toHaveBeenCalledTimes(calls);
  expect(publish.mock.lastCall?.[0].cancelledCount).toBe(1);
  const latestMessage = workers[1].onmessage!;
  workers[1].reply({
    version: 999,
    status: 'success',
    output: aggregateMarkets(input),
  });
  expect(publish).toHaveBeenCalledTimes(calls);
  session.dispose();
  expect(workers[1].terminate).toHaveBeenCalledTimes(1);
  latestMessage({
    data: { version: 2, status: 'success', output: aggregateMarkets(input) },
  } as MessageEvent<AggregationReply>);
  expect(publish).toHaveBeenCalledTimes(calls);
});
it('reports worker startup/runtime errors and can retry', () => {
  const publish = vi.fn();
  const worker = new TestWorker();
  const factory = vi
    .fn<() => WorkerPort>()
    .mockImplementationOnce(() => {
      throw new Error('unavailable');
    })
    .mockReturnValue(worker);
  const session = createOptimizedAggregation(publish, factory);
  session.update(input);
  expect(publish.mock.lastCall?.[0].state).toMatchObject({
    status: 'error',
    message: 'unavailable',
  });
  session.update(input);
  worker.onerror?.({} as ErrorEvent);
  expect(publish.mock.lastCall?.[0].state.status).toBe('error');
  expect(worker.terminate).toHaveBeenCalledOnce();
  session.dispose();
});
