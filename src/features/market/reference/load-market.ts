import type { MarketApiResponse, MarketSummary } from '../api/market-api';
import type { MarketRecord } from '../data/market-record';

export interface MarketDataset {
  records: MarketRecord[];
  summary: MarketSummary;
}

export async function loadMarket(
  query: string,
  signal: AbortSignal,
): Promise<MarketDataset> {
  signal.throwIfAborted();
  async function get<T>(path: string): Promise<T> {
    const response = await fetch(`${path}?${query}`, { signal });
    if (!response.ok)
      throw new Error(
        `Unable to load markets (HTTP ${response.status}). Check the dataset parameters and retry.`,
      );
    const body: MarketApiResponse<T> = await response.json();
    return body.data;
  }
  const [records, summary] = await Promise.all([
    get<MarketRecord[]>('/api/markets'),
    get<MarketSummary>('/api/markets/summary'),
  ]);
  return { records, summary };
}
