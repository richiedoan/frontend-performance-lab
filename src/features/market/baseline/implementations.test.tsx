import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { BaselineExplorer } from './BaselineExplorer';
import { OptimizedExplorer } from '../optimized/OptimizedExplorer';
import { loadMarket as baselineLoad } from './load-market';
import { loadMarket as optimizedLoad } from '../optimized/load-market';
import { generateMarketRecords } from '../data/generate-market-records';
import { summarizeMarkets } from '../api/market-api';
import type { MarketDataset } from './load-market';
vi.mock('./load-market', () => ({ loadMarket: vi.fn() }));
vi.mock('../optimized/load-market', () => ({ loadMarket: vi.fn() }));
beforeEach(() => {
  vi.mocked(baselineLoad).mockReset();
  vi.mocked(optimizedLoad).mockReset();
});
it.each([
  ['baseline', BaselineExplorer, baselineLoad, optimizedLoad],
  ['optimized', OptimizedExplorer, optimizedLoad, baselineLoad],
] as const)(
  '%s owns its request lifecycle and ignores stale success',
  async (_, Explorer, loader, otherLoader) => {
    const pending: {
      resolve: (data: MarketDataset) => void;
      signal: AbortSignal;
    }[] = [];
    vi.mocked(loader).mockImplementation(
      (_, signal) =>
        new Promise((resolve) => pending.push({ resolve, signal })),
    );
    const { unmount } = render(
      <StrictMode>
        <Explorer datasetQuery="seed=20260911&count=2" />
      </StrictMode>,
    );
    expect(otherLoader).not.toHaveBeenCalled();
    expect(pending[0].signal.aborted).toBe(true);
    const records = generateMarketRecords({ count: 2, seed: 20260911 });
    await act(async () =>
      pending[1].resolve({ records, summary: summarizeMarkets(records) }),
    );
    await act(async () =>
      pending[0].resolve({ records: [], summary: summarizeMarkets([]) }),
    );
    expect(screen.getAllByTestId('market-row')).toHaveLength(2);
    unmount();
    expect(pending[1].signal.aborted).toBe(true);
  },
);
