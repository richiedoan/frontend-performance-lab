import { MARKET_CATEGORIES } from '../data/market-record';
import type { MarketRecord } from '../data/market-record';
import { matchesMarket } from '../domain/market-query';
import type { MarketQuery } from '../domain/market-query';

export const DEFAULT_AGGREGATION_PASSES = 20;
export function parseAggregationPasses(value: string): number {
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 100)
    throw new Error('aggregationPasses must be an integer from 1 to 100');
  return Number(value);
}
export interface AggregationInput {
  records: readonly MarketRecord[];
  query: MarketQuery;
  passes: number;
}
/** Integer totals and canonical ID/category ordering make direct and worker outputs comparable. */
export function aggregateMarkets({ records, query, passes }: AggregationInput) {
  if (
    !Number.isInteger(passes) ||
    passes < 1 ||
    passes > 100 ||
    records.length > 10000
  )
    throw new Error(
      'Aggregation requires 1–100 passes and at most 10000 records',
    );
  const selected = records
    .filter((record) => matchesMarket(record, query.search, query.filters))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let checksum = 0;
  let categories = MARKET_CATEGORIES.map((category) => ({
    category,
    count: 0,
    priceCents: 0,
    volume: 0,
  }));
  for (let pass = 0; pass < passes; pass++) {
    categories = MARKET_CATEGORIES.map((category) => ({
      category,
      count: 0,
      priceCents: 0,
      volume: 0,
    }));
    for (const record of selected) {
      const group = categories[MARKET_CATEGORIES.indexOf(record.category)];
      group.count++;
      group.priceCents += Math.round(record.price * 100);
      group.volume += record.volume;
      for (const point of record.chartHistory)
        checksum =
          (Math.imul(checksum ^ Math.round(point.price * 100), 16777619) +
            pass) >>>
          0;
    }
  }
  return { matchedCount: selected.length, passes, categories, checksum };
}
export type AggregationOutput = ReturnType<typeof aggregateMarkets>;
