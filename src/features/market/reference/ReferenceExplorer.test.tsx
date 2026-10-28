import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ReferenceExplorer } from './ReferenceExplorer';
import { loadMarket } from './load-market';
import { generateMarketRecords } from '../data/generate-market-records';
import { summarizeMarkets } from '../api/market-api';
import type { MarketDataset } from './load-market';
vi.mock('./load-market', () => ({ loadMarket: vi.fn() }));
const records = generateMarketRecords({ count: 4, seed: 42 });
const dataset = { records, summary: summarizeMarkets(records) };
beforeEach(() => {
  vi.mocked(loadMarket).mockReset();
});

it('loads, filters, sorts, expands, refreshes with retained controls, and recovers from failure', async () => {
  let resolve!: (value: MarketDataset) => void;
  vi.mocked(loadMarket).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  render(<ReferenceExplorer datasetQuery="seed=42&count=4" />);
  expect(screen.getByTestId('market-loading')).toBeVisible();
  await act(async () => resolve(dataset));
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: records[0].name },
  });
  expect(screen.getAllByTestId('market-row')).toHaveLength(1);
  fireEvent.click(screen.getByTestId('market-sort-volume'));
  fireEvent.click(screen.getByTestId(`market-expand-${records[0].id}`));
  expect(screen.getByTestId(`market-expanded-${records[0].id}`)).toBeVisible();
  vi.mocked(loadMarket).mockRejectedValueOnce(new Error('Temporary failure'));
  fireEvent.click(screen.getByTestId('market-refresh'));
  expect(screen.getByTestId('market-loading')).toBeVisible();
  expect(screen.queryByTestId('market-summary')).not.toBeInTheDocument();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Temporary failure',
  );
  vi.mocked(loadMarket).mockResolvedValueOnce(dataset);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByRole('table');
  expect(screen.getByRole('searchbox')).toHaveValue(records[0].name);
  expect(screen.getByRole('columnheader', { name: 'Volume' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  expect(screen.getByTestId(`market-expand-${records[0].id}`)).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'no such market' },
  });
  expect(screen.getByTestId('market-empty')).toBeVisible();
  expect(loadMarket).toHaveBeenLastCalledWith(
    'seed=42&count=4',
    expect.any(AbortSignal),
  );
});

it('ignores stale StrictMode results and aborts on unmount', async () => {
  const pending: {
    resolve: (dataset: MarketDataset) => void;
    reject: (error: Error) => void;
    signal: AbortSignal;
  }[] = [];
  vi.mocked(loadMarket).mockImplementation(
    (_, signal) =>
      new Promise((resolve, reject) =>
        pending.push({ resolve, reject, signal }),
      ),
  );
  const { unmount } = render(
    <StrictMode>
      <ReferenceExplorer datasetQuery="count=4" />
    </StrictMode>,
  );
  expect(pending[0].signal.aborted).toBe(true);
  await act(async () => pending[1].resolve(dataset));
  await act(async () => pending[0].reject(new Error('stale failure')));
  expect(screen.getByRole('table')).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  unmount();
  expect(pending[1].signal.aborted).toBe(true);
});
