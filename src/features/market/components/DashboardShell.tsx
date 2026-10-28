'use client';
import { useTranslation } from '../../../i18n/useTranslation';
import { MARKET_SELECTORS } from './market-selectors';

import type { ReactNode } from 'react';
import type { MarketRecord } from '../data/market-record';
import { MarketTable } from './MarketTable';
import type { MarketTableProps } from './MarketTable';
import { EmptyState, ErrorState, LoadingSkeleton } from './MarketStates';

export type MarketViewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; records: readonly MarketRecord[] };

export interface DashboardShellProps extends Pick<
  MarketTableProps,
  'sort' | 'onSort' | 'onSelect' | 'expansion'
> {
  title: string;
  toolbar: ReactNode;
  summary: ReactNode;
  detail?: ReactNode;
  state: MarketViewState;
  onRetry: () => void;
  renderTable?: (props: MarketTableProps) => ReactNode;
}

export function DashboardShell({
  title,
  toolbar,
  summary,
  detail,
  state,
  sort,
  onSort,
  onSelect,
  onRetry,
  expansion,
  renderTable = (props) => <MarketTable {...props} />,
}: DashboardShellProps) {
  const t = useTranslation();

  return (
    <main className="market-dashboard" data-testid={MARKET_SELECTORS.dashboard}>
      <header>
        <p>{t('Live Market Explorer')}</p>
        <h1>{title}</h1>
      </header>
      {toolbar}
      {summary}
      {renderTable({
        records: state.status === 'success' ? state.records : [],
        sort,
        onSort,
        onSelect,
        expansion,
        loading: state.status === 'loading',
        placeholder:
          state.status === 'loading' ? (
            <LoadingSkeleton />
          ) : state.status === 'error' ? (
            <ErrorState message={state.message} onRetry={onRetry} />
          ) : state.records.length === 0 ? (
            <EmptyState />
          ) : undefined,
      })}
      {detail}
    </main>
  );
}
