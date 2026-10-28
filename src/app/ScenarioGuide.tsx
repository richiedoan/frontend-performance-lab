'use client';

import { useTranslation } from '../i18n/useTranslation';
import Link from 'next/link';
import {
  SCENARIOS,
  isOptimizedExplorerEnabled,
} from '../features/market/config/scenario-config';
import type { TranslationKey } from '../i18n/useTranslation';
import type { Scenario } from '../features/market/config/scenario-config';

const guides = {
  default: {
    name: 'defaultExplorer',
    problem: 'sharedExplorerBehaviorWithoutASelectedOptimization',
    action: 'searchForMarket1ChangeACategory',
  },
  'large-list': {
    name: 'largeList',
    problem: 'fulllistRenderingVersusVirtualization',
    action: 'scrollThroughTheListSortByPrice',
  },
  'search-input': {
    name: 'searchResponsiveness',
    problem: 'repeatedSearchWorkDebouncingAndCancellationOf',
    action: 'quicklyTypeMarket1ClearItThen',
  },
  'worker-aggregation': {
    name: 'workerAggregation',
    problem: 'aggregationOnTheMainThreadVersusA',
    action: 'changeTheAggregationPassesFrom20To',
  },
  'render-boundary': {
    name: 'renderBoundaries',
    problem: 'unrelatedNoteEditsCausingSummaryRenders',
    action: 'typeANoteAndToggleTheSummary',
  },
  'request-lifecycle': {
    name: 'requestLifecycle',
    problem: 'duplicateRequestsStaleResponsesAndCacheReuse',
    action: 'selectRunRequestRaceWatchTheDiagnostics',
  },
  'bundle-loading': {
    name: 'bundleLoading',
    problem: 'eagerVersusOndemandLoadingOfDrawerChart',
    action: 'openARecordToLoadItsChart',
  },
  'image-font-delivery': {
    name: 'imageAndFontDelivery',
    problem: 'imageSizingLoadingPriorityAndFontDelivery',
    action: 'reloadEachVersionWithTheSameNetwork',
  },
  'interval-memory-leak': {
    name: 'intervalCleanup',
    problem: 'timersRetainingRecordSnapshotsAfterUnmount',
    action: 'waitForAnAutorefreshTickNavigateTo',
  },
  'listener-memory-leak': {
    name: 'listenerCleanup',
    problem: 'windowListenersRetainingRecordsAfterUnmount',
    action: 'runTheListenerProbeNavigateToOverview',
  },
  'detached-dom-memory-leak': {
    name: 'detachedDomCleanup',
    problem: 'closedDrawerChartNodesRetainedInA',
    action: 'openARecordWaitForItsChart',
  },
} satisfies Record<
  Scenario,
  { name: TranslationKey; problem: TranslationKey; action: TranslationKey }
>;

function scenarioQuery(scenario: Scenario, count: number) {
  const params = new URLSearchParams({
    scenario,
    seed: '20260911',
    count: String(count),
  });
  if (scenario === 'worker-aggregation') params.set('aggregationPasses', '20');
  return params.toString();
}

export function ScenarioGuide() {
  const t = useTranslation();
  return (
    <section aria-labelledby="usage-heading">
      <h2 id="usage-heading">{t('howToUseTheLab')}</h2>
      <p>
        {t(
          isOptimizedExplorerEnabled()
            ? 'combinedDefaultsExplanation'
            : 'defaultsExplanation',
        )}
      </p>
      <p>{t('parameterDefinitions')}</p>
      <ol className="overview-steps">
        <li>{t('chooseOneScenarioBelowAndReadIts')}</li>
        <li>{t('openBothVersionsUsingItsOpenBaseline')}</li>
        <li>{t('keepTheSameScenarioSeedCountAnd')}</li>
        <li>
          {t('separateHowInteractionFeelsFromValidatedMeasurements')}{' '}
          <Link href="/case-study">{t('caseStudy')}</Link>{' '}
          {t('forEvidenceUnavailableMeansThereIsNo')}
        </li>
      </ol>
      <p className="overview-note">
        {t('theseLinksAreInteractiveDemosWithModest')}
      </p>
      <ul className="overview-scenarios" aria-label={t('scenarioDemos')}>
        {isOptimizedExplorerEnabled() && (
          <li data-tone="teal">
            <h3>{t('optimizedExplorer')}</h3>
            <p>{t('combinedOptimizationsHelp')}</p>
            <p>
              <strong>{t('try')}</strong> {t('combinedOptimizationsAction')}
            </p>
            <p>{t('demoDataset', { count: 250 })}</p>
            <div className="overview-scenario-links">
              <Link
                href="/optimized?scenario=optimized-explorer&seed=20260911&count=250"
                prefetch={false}
                aria-label={t('openScenario', {
                  action: t('openOptimized'),
                  name: t('optimizedExplorer'),
                })}
              >
                {t('openOptimized')}
              </Link>
            </div>
          </li>
        )}
        {SCENARIOS.filter(
          (scenario) => !isOptimizedExplorerEnabled() || scenario !== 'default',
        ).map((scenario) => {
          const guide = guides[scenario];
          const count =
            scenario === 'large-list'
              ? 250
              : scenario === 'image-font-delivery'
                ? 3
                : 60;
          const query = scenarioQuery(scenario, count);
          return (
            <li key={scenario} data-tone="slate">
              <h3>{t(guide.name)}</h3>
              <p>{t(guide.problem)}</p>
              <p>
                <strong>{t('try')}</strong> {t(guide.action)}
              </p>
              <p>{t('demoDataset', { count })}</p>
              <div className="overview-scenario-links">
                {(['baseline', 'optimized'] as const).map((variant) => (
                  <Link
                    key={variant}
                    href={`/${variant}?${query}`}
                    prefetch={false}
                    aria-label={t('openScenario', {
                      action: t(
                        variant === 'baseline'
                          ? 'openBaseline'
                          : 'openOptimized',
                      ),
                      name: t(guide.name),
                    })}
                  >
                    {t(
                      variant === 'baseline' ? 'openBaseline' : 'openOptimized',
                    )}
                  </Link>
                ))}
              </div>
              {scenario === 'large-list' && (
                <div role="group" aria-labelledby="full-workload-heading">
                  <h4 id="full-workload-heading">
                    {t('full5000recordWorkload')}
                  </h4>
                  <p>{t('forALocalOrDedicatedEnvironmentWith')}</p>
                  <div className="overview-scenario-links">
                    {(['baseline', 'optimized'] as const).map((variant) => (
                      <Link
                        key={variant}
                        href={`/${variant}?${scenarioQuery(scenario, 5000)}`}
                        prefetch={false}
                        aria-label={t('openFullScenario', {
                          action: t(
                            variant === 'baseline'
                              ? 'openBaseline'
                              : 'openOptimized',
                          ),
                          name: t('largeList'),
                          workload: t('full5000recordWorkload'),
                        })}
                      >
                        {t(
                          variant === 'baseline'
                            ? 'openBaseline'
                            : 'openOptimized',
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
