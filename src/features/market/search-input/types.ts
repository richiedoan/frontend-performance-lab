import type { MarketRecord } from '../data/market-record';
import type { MarketQuery } from '../domain/market-query';
export interface SearchEvent {
  requestId: number;
  query: string;
  startedAt: number;
  completedAt: number;
  outcome: 'applied' | 'stale' | 'aborted' | 'error';
}
export interface SearchStats {
  requestCount: number;
  calculationCount: number;
  abortedCount: number;
  staleCount: number;
  completions: SearchEvent[];
}
export type SearchState =
  | { status: 'loading' }
  | { status: 'success'; records: readonly MarketRecord[] }
  | { status: 'error'; message: string };
export interface SearchSnapshot {
  source: readonly MarketRecord[];
  queryKey: string;
  state: SearchState;
  stats: SearchStats;
}
export interface SearchSession {
  update: (records: readonly MarketRecord[], query: MarketQuery) => void;
  dispose: () => void;
}
export type SearchFactory = (
  publish: (snapshot: SearchSnapshot) => void,
) => SearchSession;
