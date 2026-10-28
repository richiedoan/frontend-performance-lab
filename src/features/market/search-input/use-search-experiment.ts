import { useEffect, useRef, useState } from 'react';
import type { MarketRecord } from '../data/market-record';
import type { MarketQuery } from '../domain/market-query';
import type { SearchFactory, SearchSession, SearchSnapshot } from './types';

/** Mount/unmount glue only. Scheduling policy belongs to each approach's session. */
export function useSearchExperiment(
  source: readonly MarketRecord[] | null,
  query: MarketQuery,
  factory: SearchFactory,
) {
  const session = useRef<SearchSession | null>(null);
  const [snapshot, setSnapshot] = useState<SearchSnapshot | null>(null);
  useEffect(() => {
    if (!source) return;
    const current = factory(setSnapshot);
    session.current = current;
    return () => {
      current.dispose();
      session.current = null;
    };
  }, [source, factory]);
  useEffect(() => {
    if (source) session.current?.update(source, query);
  }, [source, query, factory]);
  if (snapshot?.source !== source) return null;
  return {
    ...snapshot,
    state:
      snapshot.queryKey === JSON.stringify(query)
        ? snapshot.state
        : { status: 'loading' as const },
  };
}
