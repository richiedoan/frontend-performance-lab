import { describe, expect, it } from 'vitest';
import { generateMarketRecords } from '../data/generate-market-records';
import {
  DEFAULT_MARKET_QUERY,
  matchesMarket,
  nextMarketSort,
  selectMarkets,
} from './market-query';
import type { MarketQuery } from './market-query';

const records = generateMarketRecords({ count: 3 }).map((record, i) => ({
  ...record,
  name: ['Alpha Energy', 'beta tech', 'ALPHA Health'][i],
  price: [10, 2, 10][i],
  volume: [5, 50, 5][i],
  category: (['energy', 'technology', 'healthcare'] as const)[i],
  status: (['active', 'closed', 'active'] as const)[i],
}));
const ids = (query: MarketQuery, input = records) =>
  selectMarkets(input, query).map(({ id }) => id);

describe('market query contract', () => {
  it.each(['alpha', ' ALPHA ', '\tAlpha\n'])(
    'matches a trimmed case-insensitive name substring: %s',
    (search) => {
      expect(ids({ ...DEFAULT_MARKET_QUERY, search })).toEqual([
        records[0].id,
        records[2].id,
      ]);
    },
  );
  it('treats whitespace as no search and does not search IDs or other fields', () => {
    expect(ids({ ...DEFAULT_MARKET_QUERY, search: '   ' })).toEqual(
      ids(DEFAULT_MARKET_QUERY),
    );
    expect(ids({ ...DEFAULT_MARKET_QUERY, search: records[0].id })).toEqual([]);
    expect(ids({ ...DEFAULT_MARKET_QUERY, search: 'active' })).toEqual([]);
  });
  it('uses literal substrings, not regex, accents folding, or word reordering', () => {
    expect(matchesMarket(records[0], '.*', DEFAULT_MARKET_QUERY.filters)).toBe(
      false,
    );
    expect(
      matchesMarket(records[0], 'energy alpha', DEFAULT_MARKET_QUERY.filters),
    ).toBe(false);
    expect(
      matchesMarket(records[0], 'álpha', DEFAULT_MARKET_QUERY.filters),
    ).toBe(false);
  });
  it('combines search/category/status with AND and all removes only its own filter', () => {
    expect(
      ids({
        ...DEFAULT_MARKET_QUERY,
        search: 'alpha',
        filters: { category: 'energy', status: 'active' },
      }),
    ).toEqual([records[0].id]);
    expect(
      ids({
        ...DEFAULT_MARKET_QUERY,
        filters: { category: 'energy', status: 'closed' },
      }),
    ).toEqual([]);
    expect(
      ids({
        ...DEFAULT_MARKET_QUERY,
        filters: { category: 'all', status: 'active' },
      }),
    ).toEqual([records[0].id, records[2].id]);
    expect(
      ids({
        ...DEFAULT_MARKET_QUERY,
        filters: { category: 'technology', status: 'all' },
      }),
    ).toEqual([records[1].id]);
  });
  it.each([
    ['price', 'ascending', [1, 0, 2]],
    ['price', 'descending', [0, 2, 1]],
    ['volume', 'ascending', [0, 2, 1]],
    ['volume', 'descending', [1, 0, 2]],
  ] as const)(
    'sorts %s %s numerically with ascending ID ties',
    (key, direction, order) => {
      expect(
        ids(
          { ...DEFAULT_MARKET_QUERY, sort: { key, direction } },
          [...records].reverse(),
        ),
      ).toEqual(order.map((index) => records[index].id));
    },
  );
  it('orders names by lowercase code units and preserves ID tie ordering both directions', () => {
    const sameNames = records.map((r) => ({ ...r, name: 'same' }));
    for (const direction of ['ascending', 'descending'] as const) {
      expect(
        ids(
          { ...DEFAULT_MARKET_QUERY, sort: { key: 'name', direction } },
          sameNames.reverse(),
        ),
      ).toEqual(records.map((r) => r.id));
    }
    expect(ids(DEFAULT_MARKET_QUERY)).toEqual([
      records[0].id,
      records[2].id,
      records[1].id,
    ]);
  });
  it('returns a fresh array without modifying source records, including empty input', () => {
    const before = structuredClone(records);
    records.forEach(Object.freeze);
    const input = Object.freeze([...records]);
    expect(selectMarkets(input, DEFAULT_MARKET_QUERY)).not.toBe(input);
    expect(input).toEqual(before);
    expect(selectMarkets([], DEFAULT_MARKET_QUERY)).toEqual([]);
  });
  it('starts a new sort key ascending and toggles the active key', () => {
    expect(nextMarketSort(DEFAULT_MARKET_QUERY.sort, 'price')).toEqual({
      key: 'price',
      direction: 'ascending',
    });
    expect(
      nextMarketSort({ key: 'price', direction: 'ascending' }, 'price'),
    ).toEqual({ key: 'price', direction: 'descending' });
    expect(
      nextMarketSort({ key: 'price', direction: 'descending' }, 'price'),
    ).toEqual({ key: 'price', direction: 'ascending' });
  });
});
