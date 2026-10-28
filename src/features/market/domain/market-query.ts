import type {
  MarketCategory,
  MarketRecord,
  MarketStatus,
} from '../data/market-record';

export type MarketSortKey = 'name' | 'price' | 'change' | 'volume';
export interface MarketSort {
  key: MarketSortKey;
  direction: 'ascending' | 'descending';
}
export interface MarketFiltersValue {
  category: MarketCategory | 'all';
  status: MarketStatus | 'all';
}
export interface MarketQuery {
  search: string;
  filters: MarketFiltersValue;
  sort: MarketSort;
}
export const DEFAULT_MARKET_QUERY: Readonly<{
  search: string;
  filters: Readonly<MarketFiltersValue>;
  sort: Readonly<MarketSort>;
}> = Object.freeze({
  search: '',
  filters: Object.freeze({ category: 'all', status: 'all' }),
  sort: Object.freeze({ key: 'name', direction: 'ascending' }),
});

export function matchesMarket(
  record: MarketRecord,
  search: string,
  filters: MarketFiltersValue,
): boolean {
  return (
    record.name.toLowerCase().includes(search.trim().toLowerCase()) &&
    (filters.category === 'all' || record.category === filters.category) &&
    (filters.status === 'all' || record.status === filters.status)
  );
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A deterministic semantic reference, not a required execution strategy. */
export function selectMarkets(
  records: readonly MarketRecord[],
  query: MarketQuery,
): MarketRecord[] {
  const direction = query.sort.direction === 'ascending' ? 1 : -1;
  return records
    .filter((record) => matchesMarket(record, query.search, query.filters))
    .sort((a, b) => {
      const primary =
        query.sort.key === 'name'
          ? compareText(a.name.toLowerCase(), b.name.toLowerCase())
          : a[query.sort.key] - b[query.sort.key];
      return primary * direction || compareText(a.id, b.id);
    });
}

export function nextMarketSort(
  current: MarketSort,
  key: MarketSortKey,
): MarketSort {
  return {
    key,
    direction:
      current.key === key && current.direction === 'ascending'
        ? 'descending'
        : 'ascending',
  };
}
