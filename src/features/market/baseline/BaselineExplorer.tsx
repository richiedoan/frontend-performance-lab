'use client';
import { useTranslation } from '../../../i18n/useTranslation';
import { DetachedDomDrawer } from '../detached-dom-memory-leak/DetachedDomDrawer';
import { ListenerExperiment } from '../listener-memory-leak/ListenerExperiment';
import { IntervalExperiment } from '../interval-memory-leak/IntervalExperiment';
import { ImageFontDelivery } from '../image-font-delivery/ImageFontDelivery';
import { RequestLifecycleExperiment } from '../request-lifecycle/RequestLifecycleExperiment';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { parseScenarioConfig } from '../config/scenario-config';
import { ConfigurationError, ScenarioNotice } from '../config/ScenarioNotice';
import { DashboardShell } from '../components/DashboardShell';
import { DetailChart } from '../components/DetailChart';
import { DetailDrawer } from '../components/DetailDrawer';
import { MarketToolbar } from '../components/MarketToolbar';
import { BaselineRenderBoundarySummary } from './RenderBoundarySummary';
import { SummaryCards } from '../components/SummaryCards';
import {
  DEFAULT_MARKET_QUERY,
  matchesMarket,
  nextMarketSort,
  selectMarkets,
} from '../domain/market-query';
import type { MarketQuery } from '../domain/market-query';
import { useSearchExperiment } from '../search-input/use-search-experiment';
import { SearchDiagnostics } from '../search-input/SearchDiagnostics';
import { createBaselineSearch } from './search-session';
import { AggregationExperiment } from '../worker-aggregation/AggregationExperiment';
import { createBaselineAggregation } from './aggregation-session';
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

export function BaselineExplorer({
  datasetQuery,
  searchExperiment = false,
  renderBoundary = false,
  requestLifecycle = false,
  imageFontDelivery = false,
  intervalExperiment = false,
  listenerExperiment = false,
  detachedDomExperiment = false,
  aggregationPasses,
}: {
  datasetQuery: string;
  searchExperiment?: boolean;
  renderBoundary?: boolean;
  requestLifecycle?: boolean;
  imageFontDelivery?: boolean;
  intervalExperiment?: boolean;
  listenerExperiment?: boolean;
  detachedDomExperiment?: boolean;
  aggregationPasses?: number;
}) {
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

  const search = useSearchExperiment(
    searchExperiment && load.status === 'success' ? load.dataset.records : null,
    controls.query,
    createBaselineSearch,
  );
  const records = load.status === 'success' ? load.dataset.records : [];
  // Baseline deliberately mounts every matching record, including offscreen rows.
  // Keep this full list intact for large-list; shared presentation adds no windowing.
  const visible = searchExperiment
    ? []
    : selectMarkets(records, controls.query);
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
      title={t('Live Market Explorer')}
      toolbar={
        <>
          {imageFontDelivery && <ImageFontDelivery optimized={false} />}
          {intervalExperiment && load.status === 'success' && (
            <IntervalExperiment
              records={load.dataset.records}
              optimized={false}
            />
          )}
          {listenerExperiment && load.status === 'success' && (
            <ListenerExperiment
              records={load.dataset.records}
              optimized={false}
            />
          )}
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
          {requestLifecycle && load.status === 'success' && (
            <RequestLifecycleExperiment
              records={load.dataset.records}
              optimized={false}
            />
          )}
          {searchExperiment && <SearchDiagnostics stats={search?.stats} />}
          {aggregationPasses !== undefined && (
            <AggregationExperiment
              records={load.status === 'success' ? load.dataset.records : null}
              query={controls.query}
              initialPasses={aggregationPasses}
              factory={createBaselineAggregation}
            />
          )}
        </>
      }
      summary={
        load.status === 'success' ? (
          renderBoundary ? (
            <BaselineRenderBoundarySummary summary={load.dataset.summary} />
          ) : (
            <SummaryCards summary={load.dataset.summary} />
          )
        ) : null
      }
      state={
        load.status === 'success'
          ? searchExperiment
            ? (search?.state ?? { status: 'loading' })
            : { status: 'success', records: visible }
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
        detachedDomExperiment ? (
          <DetachedDomDrawer
            optimized={false}
            Chart={DetailChart}
            record={selected}
            onClose={() =>
              setControls((previous) => ({ ...previous, selectedId: null }))
            }
          />
        ) : (
          <DetailDrawer
            Chart={DetailChart}
            record={selected}
            onClose={() =>
              setControls((previous) => ({ ...previous, selectedId: null }))
            }
          />
        )
      }
    />
  );
}

export function BaselineRoute() {
  const query = useSearchParams().toString();
  const parsed = parseScenarioConfig(query);
  if (parsed.status === 'invalid')
    return <ConfigurationError message={parsed.message} route="/baseline" />;
  return (
    <div
      data-testid="scenario-config"
      data-scenario={parsed.config.scenario}
      data-render-strategy={
        parsed.config.scenario === 'large-list'
          ? 'baseline-full-list'
          : undefined
      }
      data-dataset-seed={parsed.config.seed}
      data-dataset-count={parsed.config.count}
    >
      <ScenarioNotice config={parsed.config} />
      <BaselineExplorer
        key={`${parsed.config.scenario}:${parsed.config.aggregationPasses}:${parsed.apiQuery}`}
        datasetQuery={parsed.apiQuery}
        renderBoundary={parsed.config.scenario === 'render-boundary'}
        requestLifecycle={parsed.config.scenario === 'request-lifecycle'}
        imageFontDelivery={parsed.config.scenario === 'image-font-delivery'}
        intervalExperiment={parsed.config.scenario === 'interval-memory-leak'}
        listenerExperiment={parsed.config.scenario === 'listener-memory-leak'}
        detachedDomExperiment={
          parsed.config.scenario === 'detached-dom-memory-leak'
        }
        aggregationPasses={
          parsed.config.scenario === 'worker-aggregation'
            ? parsed.config.aggregationPasses
            : undefined
        }
        searchExperiment={parsed.config.scenario === 'search-input'}
      />
    </div>
  );
}
