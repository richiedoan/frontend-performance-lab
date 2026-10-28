'use client';
import { scenarioLabels } from '../../../i18n/scenarioLabels';
import { useTranslation } from '../../../i18n/useTranslation';
import { DetachedDomDrawer } from '../detached-dom-memory-leak/DetachedDomDrawer';
import { ListenerExperiment } from '../listener-memory-leak/ListenerExperiment';
import { IntervalExperiment } from '../interval-memory-leak/IntervalExperiment';
import { ImageFontDelivery } from '../image-font-delivery/ImageFontDelivery';
import { RequestLifecycleExperiment } from '../request-lifecycle/RequestLifecycleExperiment';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  parseScenarioConfig,
  SCENARIOS,
  isOptimizedExplorerEnabled,
} from '../config/scenario-config';
import { ConfigurationError, ScenarioNotice } from '../config/ScenarioNotice';
import { DashboardShell } from '../components/DashboardShell';
import {
  LazyDetailChart,
  preloadDetailChart,
} from '../bundle-loading/LazyDetailChart';
import { DetailDrawer } from '../components/DetailDrawer';
import { MarketToolbar } from '../components/MarketToolbar';
import { OptimizedRenderBoundarySummary } from './RenderBoundarySummary';
import { SummaryCards } from '../components/SummaryCards';
import {
  DEFAULT_MARKET_QUERY,
  matchesMarket,
  nextMarketSort,
  selectMarkets,
} from '../domain/market-query';
import type { MarketQuery } from '../domain/market-query';
import { VirtualMarketTable } from './VirtualMarketTable';
import type { VirtualMarketTableHandle } from './VirtualMarketTable';
import { useSearchExperiment } from '../search-input/use-search-experiment';
import { SearchDiagnostics } from '../search-input/SearchDiagnostics';
import { createOptimizedSearch } from './search-session';
import { AggregationExperiment } from '../worker-aggregation/AggregationExperiment';
import { createOptimizedAggregation } from './aggregation-session';
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

export function OptimizedExplorer({
  datasetQuery,
  virtualize = false,
  searchExperiment = false,
  showSearchDiagnostics = true,
  renderBoundary = false,
  requestLifecycle = false,
  imageFontDelivery = false,
  intervalExperiment = false,
  listenerExperiment = false,
  detachedDomExperiment = false,
  bundleLoading = false,
  aggregationPasses,
}: {
  datasetQuery: string;
  virtualize?: boolean;
  searchExperiment?: boolean;
  showSearchDiagnostics?: boolean;
  renderBoundary?: boolean;
  requestLifecycle?: boolean;
  imageFontDelivery?: boolean;
  intervalExperiment?: boolean;
  listenerExperiment?: boolean;
  detachedDomExperiment?: boolean;
  bundleLoading?: boolean;
  aggregationPasses?: number;
}) {
  const t = useTranslation();

  useEffect(() => {
    if (!bundleLoading) void preloadDetailChart();
  }, [bundleLoading]);
  const virtualTableRef = useRef<VirtualMarketTableHandle>(null);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  const [controls, setControls] = useState<Controls>({
    query: DEFAULT_MARKET_QUERY,
    expandedIds: [],
    selectedId: null,
  });
  const restoreVirtualFocus = useCallback(() => {
    if (controls.selectedId && virtualTableRef.current)
      virtualTableRef.current.focusRecord(controls.selectedId);
    else
      document
        .querySelector<HTMLInputElement>('[data-testid="market-search"]')
        ?.focus();
  }, [controls.selectedId]);
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
    createOptimizedSearch,
  );
  const records = load.status === 'success' ? load.dataset.records : [];
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
      renderTable={
        virtualize
          ? (props) => (
              <VirtualMarketTable
                {...props}
                ref={virtualTableRef}
                resetKey={JSON.stringify(controls.query)}
              />
            )
          : undefined
      }
      toolbar={
        <>
          {imageFontDelivery && <ImageFontDelivery optimized={true} />}
          {intervalExperiment && load.status === 'success' && (
            <IntervalExperiment
              records={load.dataset.records}
              optimized={true}
            />
          )}
          {listenerExperiment && load.status === 'success' && (
            <ListenerExperiment
              records={load.dataset.records}
              optimized={true}
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
              optimized={true}
            />
          )}
          {searchExperiment && showSearchDiagnostics && (
            <SearchDiagnostics stats={search?.stats} />
          )}
          {aggregationPasses !== undefined && (
            <AggregationExperiment
              records={load.status === 'success' ? load.dataset.records : null}
              query={controls.query}
              initialPasses={aggregationPasses}
              factory={createOptimizedAggregation}
            />
          )}
        </>
      }
      summary={
        load.status === 'success' ? (
          renderBoundary ? (
            <OptimizedRenderBoundarySummary summary={load.dataset.summary} />
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
            optimized={true}
            Chart={LazyDetailChart}
            record={selected}
            onRestoreFocus={virtualize ? restoreVirtualFocus : undefined}
            onClose={() =>
              setControls((previous) => ({ ...previous, selectedId: null }))
            }
          />
        ) : (
          <DetailDrawer
            Chart={LazyDetailChart}
            record={selected}
            onRestoreFocus={virtualize ? restoreVirtualFocus : undefined}
            onClose={() =>
              setControls((previous) => ({ ...previous, selectedId: null }))
            }
          />
        )
      }
    />
  );
}

export function OptimizedRoute() {
  const t = useTranslation();

  const router = useRouter();
  const query = useSearchParams().toString();
  const enabled = isOptimizedExplorerEnabled();
  const parsed = parseScenarioConfig(query, enabled);
  if (parsed.status === 'invalid')
    return <ConfigurationError message={parsed.message} route="/optimized" />;
  const combined = parsed.config.scenario === 'optimized-explorer';
  return (
    <div
      data-testid="scenario-config"
      data-scenario={parsed.config.scenario}
      data-render-strategy={
        combined || parsed.config.scenario === 'large-list'
          ? 'optimized-virtual-list'
          : undefined
      }
      data-dataset-count={parsed.config.count}
      data-dataset-seed={parsed.config.seed}
    >
      <aside
        className="scenario-selector"
        aria-label={t('Optimized experiment')}
      >
        <label htmlFor="optimized-scenario">{t('Scenario')}</label>
        <select
          id="optimized-scenario"
          value={parsed.config.scenario}
          aria-describedby="optimized-scenario-help"
          onChange={(event) => {
            const params = new URLSearchParams(query);
            const scenario = event.target.value;
            params.set('scenario', scenario);
            if (
              scenario !== 'worker-aggregation' &&
              scenario !== 'optimized-explorer'
            )
              params.delete('aggregationPasses');
            router.push(`/optimized?${params}`, { scroll: false });
          }}
        >
          {enabled && (
            <option value="optimized-explorer">{t('optimizedExplorer')}</option>
          )}
          {SCENARIOS.filter(
            (scenario) =>
              !isOptimizedExplorerEnabled() || scenario !== 'default',
          ).map((scenario) => (
            <option key={scenario} value={scenario}>
              {t(scenarioLabels[scenario])}
            </option>
          ))}
        </select>
        <p id="optimized-scenario-help">
          {combined
            ? t('combinedOptimizationsHelp')
            : t(
                'Only the selected experiment is enabled. Switching scenarios keeps your dataset settings and resets experiment interactions.',
              )}
        </p>
      </aside>
      <ScenarioNotice config={parsed.config} />
      <OptimizedExplorer
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
        bundleLoading={combined || parsed.config.scenario === 'bundle-loading'}
        aggregationPasses={
          parsed.config.scenario === 'worker-aggregation'
            ? parsed.config.aggregationPasses
            : undefined
        }
        showSearchDiagnostics={!combined}
        searchExperiment={combined || parsed.config.scenario === 'search-input'}
        virtualize={combined || parsed.config.scenario === 'large-list'}
      />
    </div>
  );
}
