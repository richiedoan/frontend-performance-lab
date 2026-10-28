import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { BaselineRoute } from './BaselineExplorer';
import { loadMarket } from './load-market';
import { generateMarketRecords } from '../data/generate-market-records';
import { summarizeMarkets } from '../api/market-api';
import { DEFAULT_MARKET_QUERY, selectMarkets } from '../domain/market-query';

const navigation = vi.hoisted(() => ({ query: '' }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
}));
vi.mock('./load-market', () => ({ loadMarket: vi.fn() }));
beforeEach(() => {
  vi.mocked(loadMarket).mockReset();
});

it('mounts every configured record and preserves filtering and sorting', async () => {
  navigation.query = 'scenario=large-list&seed=20260911&count=125';
  const records = generateMarketRecords({ seed: 20260911, count: 125 });
  vi.mocked(loadMarket).mockResolvedValue({
    records,
    summary: summarizeMarkets(records),
  });
  await act(async () => {
    render(<BaselineRoute />);
  });
  const scope = screen.getByTestId('scenario-config');
  expect(scope).toHaveAttribute('data-render-strategy', 'baseline-full-list');
  expect(scope).toHaveAttribute('data-dataset-count', '125');
  const ids = () =>
    screen
      .getAllByTestId('market-row')
      .map((row) => row.getAttribute('data-market-id'));
  expect(ids()).toEqual(
    selectMarkets(records, DEFAULT_MARKET_QUERY).map((record) => record.id),
  );
  fireEvent.click(screen.getByTestId('market-sort-volume'));
  expect(ids()).toEqual(
    selectMarkets(records, {
      ...DEFAULT_MARKET_QUERY,
      sort: { key: 'volume', direction: 'ascending' },
    }).map((record) => record.id),
  );
  fireEvent.change(screen.getByTestId('market-search'), {
    target: { value: records[124].name },
  });
  expect(ids()).toEqual([records[124].id]);
  fireEvent.change(screen.getByTestId('market-search'), {
    target: { value: '' },
  });
  expect(ids()).toHaveLength(125);
});

it.each(['scenario=large-list', 'scenario=default'])(
  'keeps defaults and marks only large-list: %s',
  async (query) => {
    navigation.query = query;
    vi.mocked(loadMarket).mockResolvedValue({
      records: [],
      summary: summarizeMarkets([]),
    });
    await act(async () => {
      render(<BaselineRoute />);
    });
    const scope = screen.getByTestId('scenario-config');
    expect(scope).toHaveAttribute('data-dataset-count', '5000');
    expect(scope).toHaveAttribute('data-dataset-seed', '20260911');
    if (query.includes('large-list'))
      expect(scope).toHaveAttribute(
        'data-render-strategy',
        'baseline-full-list',
      );
    else expect(scope).not.toHaveAttribute('data-render-strategy');
    const params = new URLSearchParams(vi.mocked(loadMarket).mock.calls[0][0]);
    expect(params.get('count')).toBe('5000');
    expect(params.get('seed')).toBe('20260911');
  },
);
