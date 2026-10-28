import type { MarketRecord } from '../data/market-record';
import { selectMarkets } from '../domain/market-query';
import type { MarketQuery } from '../domain/market-query';

export const SEARCH_PASSES = 12;
export const SEARCH_DEBOUNCE_MS = 250;
export function searchDeliveryDelay(query: MarketQuery) {
  return query.search.trim().length <= 1 ? 400 : 60;
}
export type SearchRequest = (
  records: readonly MarketRecord[],
  query: MarketQuery,
  signal: AbortSignal,
  calculated: () => void,
) => Promise<MarketRecord[]>;
/** Local asynchronous mock request, not an HTTP request. Same workload for both approaches. */
export const requestSearch: SearchRequest = (
  records,
  query,
  signal,
  calculated,
) => {
  if (signal.aborted)
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  let result: MarketRecord[] = [];
  for (let pass = 0; pass < SEARCH_PASSES; pass++) {
    result = selectMarkets(records, query);
    calculated();
  }
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve(result);
    }, searchDeliveryDelay(query));
    signal.addEventListener('abort', abort, { once: true });
  });
};
