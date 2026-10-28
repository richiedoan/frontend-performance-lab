import { DetailChart } from './DetailChart';
import { StrictMode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateMarketRecords } from '../data/generate-market-records';
import { summarizeMarkets } from '../api/market-api';
import { DashboardShell } from './DashboardShell';
import { DetailDrawer } from './DetailDrawer';
import { MarketToolbar, SearchInput } from './MarketToolbar';
import { MarketTable } from './MarketTable';
import { SummaryCards } from './SummaryCards';

const records = generateMarketRecords({ count: 2, seed: 42 });
const sort = { key: 'name', direction: 'ascending' } as const;
const dialogDescriptors = Object.getOwnPropertyDescriptors(
  HTMLDialogElement.prototype,
);
afterEach(() => {
  vi.restoreAllMocks();
  for (const method of ['showModal', 'close']) {
    if (dialogDescriptors[method])
      Object.defineProperty(
        HTMLDialogElement.prototype,
        method,
        dialogDescriptors[method],
      );
    else Reflect.deleteProperty(HTMLDialogElement.prototype, method);
  }
});

it('renders labeled controlled search, filters and refresh callbacks', () => {
  const onSearchChange = vi.fn();
  const onFiltersChange = vi.fn();
  const onRefresh = vi.fn();
  const props = {
    search: '',
    filters: { category: 'all', status: 'active' } as const,
    onSearchChange,
    onFiltersChange,
    onRefresh,
  };
  const { rerender } = render(<MarketToolbar {...props} />);
  const search = screen.getByRole('searchbox', { name: 'Search markets' });
  fireEvent.change(search, { target: { value: 'Energy' } });
  expect(onSearchChange).toHaveBeenCalledWith('Energy');
  expect(search).toHaveValue('');
  fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), {
    target: { value: 'energy' },
  });
  expect(onFiltersChange).toHaveBeenCalledWith({
    category: 'energy',
    status: 'active',
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Status' }), {
    target: { value: 'closed' },
  });
  expect(onFiltersChange).toHaveBeenCalledWith({
    category: 'all',
    status: 'closed',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh markets' }));
  expect(onRefresh).toHaveBeenCalledTimes(1);
  rerender(<MarketToolbar {...props} search="Energy" refreshing />);
  expect(search).toHaveValue('Energy');
  const refresh = screen.getByRole('button', { name: 'Refreshing…' });
  expect(refresh).toBeDisabled();
  fireEvent.click(refresh);
  expect(onRefresh).toHaveBeenCalledTimes(1);
});

it('gives repeated search inputs distinct label associations', () => {
  render(
    <>
      <SearchInput value="first" onChange={vi.fn()} />
      <SearchInput value="second" onChange={vi.fn()} />
    </>,
  );
  expect(
    screen
      .getAllByRole('searchbox', { name: 'Search markets' })
      .map((input) => input.id),
  ).toEqual([expect.any(String), expect.any(String)]);
  const inputs = screen.getAllByRole('searchbox');
  expect(inputs[0].id).not.toBe(inputs[1].id);
});

it('preserves supplied row order and emits selection and sort without processing data', () => {
  const onSelect = vi.fn();
  const onSort = vi.fn();
  const { rerender } = render(
    <MarketTable
      records={[records[1], records[0]]}
      sort={sort}
      onSelect={onSelect}
      onSort={onSort}
    />,
  );
  const table = screen.getByRole('table', { name: 'Market records' });
  expect(
    within(table)
      .getAllByRole('rowheader')
      .map((cell) => cell.textContent),
  ).toEqual([records[1].name, records[0].name]);
  expect(screen.getByRole('columnheader', { name: 'Market' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Sort by price' }));
  expect(onSort).toHaveBeenCalledWith('price');
  fireEvent.click(
    screen.getByRole('button', { name: `View details for ${records[0].name}` }),
  );
  expect(onSelect).toHaveBeenCalledExactlyOnceWith(records[0].id);
  const row = within(table).getAllByRole('row')[1];
  expect(within(row).getByText(records[1].status)).toBeVisible();
  expect(
    within(row).getByText(
      `${records[1].change > 0 ? '+' : ''}${records[1].change.toFixed(2)}%`,
    ),
  ).toBeVisible();
  expect(
    within(row).getByRole('img', { name: records[1].image.alt }),
  ).toHaveAttribute('width', '64');
  expect(
    screen.getByRole('region', { name: 'Market records' }),
  ).toHaveAttribute('tabindex', '0');
  rerender(
    <MarketTable
      records={records}
      sort={{ key: 'price', direction: 'descending' }}
      onSelect={onSelect}
      onSort={onSort}
    />,
  );
  expect(screen.getByRole('columnheader', { name: 'Price' })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
});

it('shows supplied summary numbers and explicit unavailable values for empty data', () => {
  const summary = summarizeMarkets(records);
  const { rerender } = render(<SummaryCards summary={summary} />);
  const region = screen.getByRole('region', { name: 'Market summary' });
  expect(
    within(region).getByText(summary.totalVolume.toLocaleString('en-US')),
  ).toBeVisible();
  expect(
    within(region).getByText(`$${summary.averagePrice?.toFixed(2)}`),
  ).toBeVisible();
  rerender(<SummaryCards summary={summarizeMarkets([])} />);
  expect(screen.getAllByText('Not available')).toHaveLength(2);
  expect(screen.getAllByText('0')).toHaveLength(2);
});

it('composes a landmark and exclusive loading, error, empty and success views', () => {
  const onRetry = vi.fn();
  const props = {
    title: 'Market dashboard',
    toolbar: <p>Toolbar slot</p>,
    summary: null,
    sort,
    onSort: vi.fn(),
    onSelect: vi.fn(),
    onRetry,
  };
  const { rerender } = render(
    <DashboardShell {...props} state={{ status: 'loading' }} />,
  );
  expect(screen.getByRole('main')).toBeVisible();
  expect(screen.getByRole('table').querySelector('caption')).toBeNull();
  expect(
    screen.getByRole('heading', { level: 1, name: 'Market dashboard' }),
  ).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('Loading markets…');
  expect(screen.getByRole('table', { name: 'Market records' })).toHaveAttribute(
    'aria-busy',
    'true',
  );
  expect(screen.getByRole('button', { name: 'Sort by volume' })).toBeVisible();
  expect(screen.queryByTestId('market-row')).not.toBeInTheDocument();
  rerender(
    <DashboardShell
      {...props}
      state={{ status: 'error', message: 'Unable to load markets' }}
    />,
  );
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Unable to load markets');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(onRetry).toHaveBeenCalledTimes(1);
  rerender(
    <DashboardShell {...props} state={{ status: 'success', records: [] }} />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('No markets match');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  rerender(
    <DashboardShell {...props} state={{ status: 'success', records }} />,
  );
  expect(screen.getByRole('table')).toBeVisible();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

describe('DetailDrawer', () => {
  function mockDialog() {
    // jsdom has no native dialog methods. Browser modal focus containment is native;
    // these mocks only model visibility so we can test our callbacks and cleanup.
    const show = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    const close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: { configurable: true, value: show },
      close: { configurable: true, value: close },
    });
    return { show, close };
  }

  it('focuses close, renders record/chart, emits dismissal and restores opener focus', () => {
    mockDialog();
    const onClose = vi.fn();
    const { rerender } = render(
      <>
        <button type="button">Open record</button>
        <DetailDrawer Chart={DetailChart} record={null} onClose={onClose} />
      </>,
    );
    const opener = screen.getByRole('button', { name: 'Open record' });
    opener.focus();
    rerender(
      <>
        <button type="button">Open record</button>
        <DetailDrawer
          Chart={DetailChart}
          record={records[0]}
          onClose={onClose}
        />
      </>,
    );
    const dialog = screen.getByRole('dialog', { name: records[0].name });
    const close = within(dialog).getByRole('button', { name: 'Close details' });
    expect(close).toHaveFocus();
    expect(
      within(dialog).getByRole('img', { name: /Price history/ }),
    ).toBeVisible();
    expect(within(dialog).getByText(records[0].updatedAt)).toHaveAttribute(
      'datetime',
      records[0].updatedAt,
    );
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
    // Native Escape dispatches cancel. Controlled props determine when it closes.
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
    rerender(
      <>
        <button type="button">Open record</button>
        <DetailDrawer Chart={DetailChart} record={null} onClose={onClose} />
      </>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('closes on backdrop clicks but keeps clicks inside the panel open', () => {
    mockDialog();
    const onClose = vi.fn();
    const { unmount } = render(
      <DetailDrawer
        Chart={DetailChart}
        record={records[0]}
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole('dialog');
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      left: 500,
      right: 1000,
      top: 0,
      bottom: 800,
      width: 500,
      height: 800,
      x: 500,
      y: 0,
      toJSON() {},
    });
    fireEvent.click(dialog, { clientX: 600, clientY: 100 });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(dialog, { clientX: 100, clientY: 100 });
    expect(onClose).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('button', { name: 'Close details' }),
    ).toHaveTextContent('×');
    unmount();
  });

  it('supports StrictMode cleanup and updates record content without reopening', () => {
    const { show, close } = mockDialog();
    const onClose = vi.fn();
    const { rerender, unmount } = render(
      <StrictMode>
        <DetailDrawer
          Chart={DetailChart}
          record={records[0]}
          onClose={onClose}
        />
      </StrictMode>,
    );
    const calls = show.mock.calls.length;
    rerender(
      <StrictMode>
        <DetailDrawer
          Chart={DetailChart}
          record={{ ...records[1], chartHistory: [] }}
          onClose={onClose}
        />
      </StrictMode>,
    );
    expect(screen.getByRole('dialog', { name: records[1].name })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(
      'No price history available',
    );
    expect(show).toHaveBeenCalledTimes(calls);
    unmount();
    expect(close).toHaveBeenCalledTimes(calls);
    expect(onClose).not.toHaveBeenCalled();
  });
});

it('exposes stable row hooks and controlled independent expansion', () => {
  const onToggle = vi.fn();
  const props = { records, sort, onSelect: vi.fn(), onSort: vi.fn() };
  const { rerender } = render(
    <MarketTable {...props} expansion={{ expandedIds: [], onToggle }} />,
  );
  const button = screen.getByRole('button', {
    name: `Expand ${records[0].name}`,
  });
  expect(button).toHaveAttribute(
    'data-testid',
    `market-expand-${records[0].id}`,
  );
  expect(button).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(button);
  expect(onToggle).toHaveBeenCalledExactlyOnceWith(records[0].id);
  expect(button).toHaveAttribute('aria-expanded', 'false');
  rerender(
    <MarketTable
      {...props}
      expansion={{ expandedIds: [records[0].id], onToggle }}
    />,
  );
  expect(
    screen.getByRole('button', { name: `Collapse ${records[0].name}` }),
  ).toHaveAttribute('aria-expanded', 'true');
  const expanded = document.getElementById(
    button.getAttribute('aria-controls')!,
  );
  expect(expanded).toBeVisible();
  expect(within(expanded!).getByText(records[0].updatedAt)).toBeVisible();
  expect(
    screen.getByRole('button', { name: `Expand ${records[1].name}` }),
  ).toHaveAttribute('aria-expanded', 'false');
  expect(
    screen
      .getAllByTestId('market-row')
      .map((row) => row.getAttribute('data-market-id')),
  ).toEqual(records.map((record) => record.id));
  rerender(
    <MarketTable
      {...props}
      records={[...records].reverse()}
      expansion={{ expandedIds: [records[0].id], onToggle }}
    />,
  );
  expect(
    screen.getByRole('button', { name: `Collapse ${records[0].name}` }),
  ).toHaveAttribute('aria-expanded', 'true');
});

it('indicates every sortable column and distinguishes the active direction', () => {
  const onSort = vi.fn();
  const { rerender } = render(
    <MarketTable
      records={records}
      sort={sort}
      onSort={onSort}
      onSelect={vi.fn()}
    />,
  );
  expect(
    screen.getByRole('button', { name: 'Sort by name' }),
  ).toHaveTextContent('↑');
  for (const key of ['price', 'change', 'volume']) {
    expect(
      screen.getByRole('button', { name: `Sort by ${key}` }),
    ).toHaveTextContent('↕');
  }
  fireEvent.click(screen.getByRole('button', { name: 'Sort by price' }));
  expect(onSort).toHaveBeenCalledWith('price');
  rerender(
    <MarketTable
      records={records}
      sort={{ key: 'price', direction: 'descending' }}
      onSort={onSort}
      onSelect={vi.fn()}
    />,
  );
  expect(
    screen.getByRole('button', { name: 'Sort by price' }),
  ).toHaveTextContent('↓');
  expect(
    screen.getByRole('button', { name: 'Sort by name' }),
  ).toHaveTextContent('↕');
  expect(
    screen
      .getByRole('columnheader', { name: 'Category' })
      .querySelector('button'),
  ).toBeNull();
});

it('keeps signed changes and status text alongside color cues', () => {
  const samples = [
    { ...records[0], id: 'positive', change: 2.5, status: 'active' as const },
    { ...records[0], id: 'negative', change: -1.25, status: 'paused' as const },
    { ...records[0], id: 'neutral', change: 0, status: 'closed' as const },
  ];
  render(
    <MarketTable
      records={samples}
      sort={sort}
      onSort={vi.fn()}
      onSelect={vi.fn()}
    />,
  );
  for (const [index, status] of ['active', 'paused', 'closed'].entries()) {
    const row = screen.getAllByTestId('market-row')[index];
    expect(within(row).getByText(status)).toBeVisible();
    expect(row).toHaveAttribute('data-striped', String(index % 2 === 1));
  }
  expect(screen.getByText('+2.50%')).toBeVisible();
  expect(screen.getByText('-1.25%')).toBeVisible();
  expect(screen.getByText('0.00%')).toBeVisible();
});
