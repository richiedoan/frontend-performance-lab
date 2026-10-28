import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateMarketRecords } from '../../../features/market/data/generate-market-records';
import { GET as collection } from './route';
import { GET as detail } from './[id]/route';
import { GET as summary } from './summary/route';

const endpoints = [
  { name: 'collection', get: collection },
  {
    name: 'detail',
    get: (request: Request) =>
      detail(request, { params: Promise.resolve({ id: 'market-000001' }) }),
  },
  { name: 'summary', get: summary },
];
const request = (query = '') =>
  new Request(`http://localhost/api/markets${query}`);

afterEach(() => {
  vi.useRealTimers();
});

describe.each(endpoints)('$name contract', ({ get }) => {
  it('returns deterministic JSON and explicit dataset metadata', async () => {
    const first = await get(request('?seed=-1.25&count=3&delayMs=0'));
    expect(first.status).toBe(200);
    expect(first.headers.get('content-type')).toContain('application/json');
    const body = await first.json();
    expect(Object.keys(body).sort()).toEqual(['data', 'meta']);
    expect(body.meta).toEqual({
      generatorVersion: 1,
      seed: -1.25,
      count: 3,
      delayMs: 0,
    });
    await get(request('?seed=99&count=2'));
    expect(await (await get(request('?seed=-1.25&count=3'))).json()).toEqual(
      body,
    );
    expect(
      (await (await get(request('?seed=42&count=3'))).json()).data,
    ).not.toEqual(body.data);
  });

  it('uses safe defaults', async () => {
    const response = await get(request());
    expect(response.status).toBe(200);
    expect((await response.json()).meta).toEqual({
      generatorVersion: 1,
      seed: 20260911,
      count: 5_000,
      delayMs: 0,
    });
  });

  it.each([
    'count=-1',
    'count=10001',
    'count=1.5',
    'count=',
    'count=NaN',
    'count=Infinity',
    'count=0x10',
    'count=%20',
    'count=1&count=2',
    'seed=',
    'seed=NaN',
    'seed=Infinity',
    'seed=9007199254740992',
    'seed=-9007199254740992',
    'seed=1&seed=2',
    'delayMs=-1',
    'delayMs=5001',
    'delayMs=0.5',
    'delayMs=',
    'delayMs=Infinity',
    'delayMs=0&delayMs=1',
    'simulateError=1',
    'simulateError=',
    'simulateError=true&simulateError=false',
    'unexpected=true',
    'count=1oops',
  ])('rejects invalid query %s', async (query) => {
    const response = await get(request(`?${query}`));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_REQUEST', message: expect.any(String) },
    });
  });

  it.each([-9007199254740991, 0, 9007199254740991])(
    'accepts bounded seed %s',
    async (seed) => {
      const response = await get(request(`?seed=${seed}&count=1`));
      expect(response.status).toBe(200);
      expect((await response.json()).meta.seed).toBe(seed);
    },
  );

  it('accepts the maximum record count', async () => {
    const response = await get(request('?count=10000'));
    expect(response.status).toBe(200);
    expect((await response.json()).meta.count).toBe(10000);
  });

  it.each([1, 250, 5000])(
    'waits for the configured %i ms delay',
    async (delayMs) => {
      vi.useFakeTimers();
      const settled = vi.fn();
      const pending = get(request(`?count=1&delayMs=${delayMs}`)).then(
        (response) => {
          settled();
          return response;
        },
      );
      await vi.advanceTimersByTimeAsync(delayMs - 1);
      expect(settled).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      const response = await pending;
      expect(response.status).toBe(200);
      expect((await response.json()).meta.delayMs).toBe(delayMs);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('does not schedule a timer for zero delay', async () => {
    vi.useFakeTimers();
    expect((await get(request('?count=1&delayMs=0'))).status).toBe(200);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('simulates a delayed failure only for that request', async () => {
    vi.useFakeTimers();
    const settled = vi.fn();
    const pending = get(
      request('?count=1&simulateError=true&delayMs=100'),
    ).then((response) => {
      settled();
      return response;
    });
    expect((await get(request('?count=1&simulateError=false'))).status).toBe(
      200,
    );
    await vi.advanceTimersByTimeAsync(99);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    const response = await pending;
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: 'SIMULATED_ERROR',
        message: 'Simulated market API failure',
      },
    });
    expect((await get(request('?count=1'))).status).toBe(200);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('validates before delay and error simulation', async () => {
    vi.useFakeTimers();
    expect(
      (await get(request('?count=-1&delayMs=5000&simulateError=true'))).status,
    ).toBe(400);
    expect(vi.getTimerCount()).toBe(0);
  });
});

it('collection and detail reuse the exact generator records', async () => {
  const expected = generateMarketRecords({ seed: 42, count: 3 });
  expect(
    (await (await collection(request('?seed=42&count=3'))).json()).data,
  ).toEqual(expected);
  for (const record of expected) {
    const response = await detail(request('?seed=42&count=3'), {
      params: Promise.resolve({ id: record.id }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(record);
  }
});

it('summary aggregates the same dataset', async () => {
  const records = generateMarketRecords({ seed: 42, count: 20 });
  const response = await summary(request('?seed=42&count=20'));
  const { data } = await response.json();
  expect(data).toEqual({
    totalRecords: 20,
    totalVolume: records.reduce((sum, record) => sum + record.volume, 0),
    averagePrice:
      Math.round(
        (records.reduce((sum, record) => sum + record.price, 0) / 20) * 100,
      ) / 100,
    averageChange:
      Math.round(
        (records.reduce((sum, record) => sum + record.change, 0) / 20) * 100,
      ) / 100,
    latestUpdatedAt: records
      .map((record) => record.updatedAt)
      .sort()
      .at(-1),
    byCategory: Object.fromEntries(
      ['technology', 'energy', 'healthcare', 'consumer', 'industrial'].map(
        (category) => [
          category,
          records.filter((record) => record.category === category).length,
        ],
      ),
    ),
    byStatus: Object.fromEntries(
      ['active', 'paused', 'closed'].map((status) => [
        status,
        records.filter((record) => record.status === status).length,
      ]),
    ),
  });
});

it('returns explicit empty collection and summary values', async () => {
  expect((await (await collection(request('?count=0'))).json()).data).toEqual(
    [],
  );
  expect((await (await summary(request('?count=0'))).json()).data).toEqual({
    totalRecords: 0,
    totalVolume: 0,
    averagePrice: null,
    averageChange: null,
    latestUpdatedAt: null,
    byCategory: {
      technology: 0,
      energy: 0,
      healthcare: 0,
      consumer: 0,
      industrial: 0,
    },
    byStatus: { active: 0, paused: 0, closed: 0 },
  });
});

it.each([
  ['market-000001', 0],
  ['market-000003', 2],
  ['unknown', 2],
  ['market-1', 2],
])(
  'returns 404 for missing ID %s with count %i after the configured delay',
  async (id, count) => {
    vi.useFakeTimers();
    const settled = vi.fn();
    const pending = detail(request(`?count=${count}&delayMs=10`), {
      params: Promise.resolve({ id }),
    }).then((response) => {
      settled();
      return response;
    });
    await vi.advanceTimersByTimeAsync(9);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    const response = await pending;
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Market record not found' },
    });
  },
);
