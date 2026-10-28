'use client';
import { useTranslation } from '../../../i18n/useTranslation';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardShell } from '../components/DashboardShell';
import { DetailChart } from '../components/DetailChart';
import { DetailDrawer } from '../components/DetailDrawer';
import { MarketToolbar } from '../components/MarketToolbar';
import { SummaryCards } from '../components/SummaryCards';
import {
  DEFAULT_MARKET_QUERY,
  matchesMarket,
  nextMarketSort,
  selectMarkets,
} from '../domain/market-query';
import type { MarketQuery } from '../domain/market-query';
import { loadMarket } from './load-market';
import type { MarketDataset } from './load-market';

interface Controls {
  query: MarketQuery;
  expandedIds: string[];
  selectedId: string | null;
}
type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; dataset: MarketDataset };

export function ReferenceExplorer({ datasetQuery }: { datasetQuery: string }) {
  const t = useTranslation();

  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  const [controls, setControls] = useState<Controls>({
    query: DEFAULT_MARKET_QUERY,
    expandedIds: [],
    selectedId: null,
  });
  useEffect(() => {
    const controller = new AbortController();
    loadMarket(datasetQuery, controller.signal)
      .then((dataset) => {
        if (!controller.signal.aborted) setLoad({ status: 'success', dataset });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoad({
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Unable to load markets. Please retry.',
          });
          controller.abort();
        }
      });
    return () => controller.abort();
  }, [datasetQuery, revision]);

  const records = load.status === 'success' ? load.dataset.records : [];
  const visible = selectMarkets(records, controls.query);
  const selected =
    records.find((record) => record.id === controls.selectedId) ?? null;
  function changeQuery(update: (query: MarketQuery) => MarketQuery) {
    setControls((previous) => {
      const query = update(previous.query);
      const retained = new Set(
        records
          .filter((record) =>
            matchesMarket(record, query.search, query.filters),
          )
          .map((record) => record.id),
      );
      return {
        query,
        expandedIds: previous.expandedIds.filter((id) => retained.has(id)),
        selectedId:
          previous.selectedId !== null && retained.has(previous.selectedId)
            ? previous.selectedId
            : null,
      };
    });
  }
  function refresh() {
    if (load.status === 'loading') return;
    setControls((previous) => ({
      ...previous,
      expandedIds: [],
      selectedId: null,
    }));
    setLoad({ status: 'loading' });
    setRevision((previous) => previous + 1);
  }
  return (
    <DashboardShell
      title={t('Reference Market Explorer')}
      toolbar={
        <MarketToolbar
          search={controls.query.search}
          filters={controls.query.filters}
          onSearchChange={(search) =>
            changeQuery((query) => ({ ...query, search }))
          }
          onFiltersChange={(filters) =>
            changeQuery((query) => ({ ...query, filters }))
          }
          refreshing={load.status === 'loading'}
          onRefresh={refresh}
        />
      }
      summary={
        load.status === 'success' ? (
          <SummaryCards summary={load.dataset.summary} />
        ) : null
      }
      state={
        load.status === 'success'
          ? { status: 'success', records: visible }
          : load
      }
      sort={controls.query.sort}
      onSort={(key) =>
        setControls((previous) => ({
          ...previous,
          query: {
            ...previous.query,
            sort: nextMarketSort(previous.query.sort, key),
          },
        }))
      }
      onSelect={(selectedId) =>
        setControls((previous) => ({ ...previous, selectedId }))
      }
      expansion={{
        expandedIds: controls.expandedIds,
        onToggle: (id) =>
          setControls((previous) => ({
            ...previous,
            expandedIds: previous.expandedIds.includes(id)
              ? previous.expandedIds.filter((value) => value !== id)
              : [...previous.expandedIds, id],
          })),
      }}
      onRetry={refresh}
      detail={
        <DetailDrawer
          Chart={DetailChart}
          record={selected}
          onClose={() =>
            setControls((previous) => ({ ...previous, selectedId: null }))
          }
        />
      }
    />
  );
}

export function ReferenceRoute() {
  const query = useSearchParams().toString();
  return <ReferenceExplorer key={query} datasetQuery={query} />;
}
