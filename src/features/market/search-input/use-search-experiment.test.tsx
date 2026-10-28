import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSearchExperiment } from './use-search-experiment';
import { createBaselineSearch } from '../baseline/search-session';
import { createOptimizedSearch } from '../optimized/search-session';
import { generateMarketRecords } from '../data/generate-market-records';
import { DEFAULT_MARKET_QUERY } from '../domain/market-query';
import type { MarketQuery } from '../domain/market-query';
import type { SearchFactory } from './types';
const records = generateMarketRecords({ count: 4, seed: 20260911 });
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});
function Harness({
  query,
  factory,
  enabled = true,
}: {
  query: MarketQuery;
  factory: SearchFactory;
  enabled?: boolean;
}) {
  const snapshot = useSearchExperiment(
    enabled ? records : null,
    query,
    factory,
  );
  return (
    <output data-testid="snapshot">
      {JSON.stringify(
        snapshot ? { state: snapshot.state, stats: snapshot.stats } : null,
      )}
    </output>
  );
}
it.each([createBaselineSearch, createOptimizedSearch])(
  'survives StrictMode, follows the latest query, and cancels all work on unmount',
  async (factory) => {
    const view = render(
      <StrictMode>
        <Harness
          query={{ ...DEFAULT_MARKET_QUERY, search: 'm' }}
          factory={factory}
        />
      </StrictMode>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    view.rerender(
      <StrictMode>
        <Harness
          query={{ ...DEFAULT_MARKET_QUERY, search: 'no matches' }}
          factory={factory}
        />
      </StrictMode>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(650);
    });
    const snapshot = JSON.parse(screen.getByTestId('snapshot').textContent!);
    expect(snapshot.state).toEqual({ status: 'success', records: [] });
    expect(snapshot.stats.requestCount).toBe(2);
    view.rerender(
      <StrictMode>
        <Harness query={DEFAULT_MARKET_QUERY} factory={factory} />
      </StrictMode>,
    );
    view.unmount();
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(vi.getTimerCount()).toBe(0);
  },
);
it('does not create search sessions outside the scenario', () => {
  const factory = vi.fn(createBaselineSearch);
  render(
    <Harness query={DEFAULT_MARKET_QUERY} factory={factory} enabled={false} />,
  );
  expect(factory).not.toHaveBeenCalled();
});
