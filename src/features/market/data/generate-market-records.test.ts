import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_RECORD_COUNT,
  DEFAULT_SEED,
  generateMarketRecords,
} from './generate-market-records';
import { MARKET_CATEGORIES, MARKET_STATUSES } from './market-record';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('generateMarketRecords', () => {
  it('defaults to 5,000 records with seed 20260911', () => {
    const records = generateMarketRecords();
    expect(DEFAULT_RECORD_COUNT).toBe(5_000);
    expect(DEFAULT_SEED).toBe(20260911);
    expect(records).toHaveLength(5_000);
    expect(records).toEqual(
      generateMarketRecords({ count: 5_000, seed: 20260911 }),
    );
  });

  it.each([0, 1, 17, 5_001])('returns exactly %i records', (count) => {
    expect(generateMarketRecords({ count })).toHaveLength(count);
  });

  it.each([0, -123, 1.25, 20260911, Number.MAX_VALUE])(
    'is deterministic for seed %s regardless of clock or prior calls',
    (seed) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2000-01-01T00:00:00Z'));
      const first = generateMarketRecords({ seed, count: 5 });
      generateMarketRecords({ seed: 999, count: 20 });
      vi.setSystemTime(new Date('2040-01-01T00:00:00Z'));
      expect(generateMarketRecords({ seed, count: 5 })).toEqual(first);
    },
  );

  it('produces different values for different seeds', () => {
    expect(generateMarketRecords({ seed: 1, count: 10 })).not.toEqual(
      generateMarketRecords({ seed: 2, count: 10 }),
    );
  });

  it('keeps IDs unique and stable across seeds and dataset sizes', () => {
    const records = generateMarketRecords();
    expect(new Set(records.map(({ id }) => id)).size).toBe(5_000);
    expect(records[0].id).toBe('market-000001');
    expect(records[4_999].id).toBe('market-005000');
    const small = generateMarketRecords({ count: 10 });
    expect(small).toEqual(records.slice(0, 10));
    expect(
      generateMarketRecords({ seed: 42, count: 10 }).map(({ id }) => id),
    ).toEqual(small.map(({ id }) => id));
  });

  it('returns valid, internally consistent records and chart histories', () => {
    const isPrice = (value: number) =>
      Number.isFinite(value) &&
      value >= 10 &&
      value <= 10_000 &&
      Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;
    for (const record of generateMarketRecords()) {
      expect(record.name.length).toBeGreaterThan(0);
      expect(MARKET_CATEGORIES).toContain(record.category);
      expect(MARKET_STATUSES).toContain(record.status);
      expect(isPrice(record.price)).toBe(true);
      expect(
        Number.isInteger(record.volume) &&
          record.volume >= 0 &&
          record.volume <= 10_000_000,
      ).toBe(true);
      expect(
        Number.isFinite(record.change) && Math.abs(record.change) <= 25,
      ).toBe(true);
      expect(record.chartHistory).toHaveLength(24);
      expect(
        record.chartHistory.every(
          (point, index, history) =>
            isPrice(point.price) &&
            new Date(point.timestamp).toISOString() === point.timestamp &&
            (index === 0 ||
              Date.parse(point.timestamp) -
                Date.parse(history[index - 1].timestamp) ===
                3_600_000),
        ),
      ).toBe(true);
      expect(record.chartHistory[23]).toEqual({
        timestamp: record.updatedAt,
        price: record.price,
      });
      expect(Date.parse(record.updatedAt)).toBeGreaterThan(
        Date.parse('2026-09-10T12:00:00.000Z'),
      );
      expect(Date.parse(record.updatedAt)).toBeLessThanOrEqual(
        Date.parse('2026-09-11T12:00:00.000Z'),
      );
      expect(record.change).toBeCloseTo(
        (record.price / record.chartHistory[0].price - 1) * 100,
        2,
      );
      expect(record.image).toMatchObject({
        alt: `${record.name} icon`,
        width: 64,
        height: 64,
      });
      expect(decodeURIComponent(record.image.src)).toMatch(
        /^data:image\/svg\+xml,<svg .*<\/svg>$/,
      );
    }
  });

  it('does not use ambient randomness and returns independent nested objects', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Unexpected ambient randomness');
    });
    const first = generateMarketRecords({ count: 2 });
    const second = generateMarketRecords({ count: 2 });
    first[0].image.alt = 'modified';
    first[0].chartHistory[0].price = -1;
    expect(second).toEqual(generateMarketRecords({ count: 2 }));
    expect(first[1]).toEqual(second[1]);
  });

  it.each([-1, 0.5, NaN, Infinity, 4294967296])(
    'rejects invalid count %s',
    (count) => {
      expect(() => generateMarketRecords({ count })).toThrow(RangeError);
    },
  );

  it.each([NaN, Infinity, -Infinity])(
    'rejects non-finite seed %s even for empty datasets',
    (seed) => {
      expect(() => generateMarketRecords({ count: 0, seed })).toThrow(
        RangeError,
      );
    },
  );
});
