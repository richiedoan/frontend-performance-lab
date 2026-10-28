'use client';

import { useLanguage, useTranslation } from '../i18n/useTranslation';
import Link from 'next/link';
import { ScenarioGuide } from './ScenarioGuide';

export default function HomePage() {
  const { language } = useLanguage();
  const t = useTranslation();
  return (
    <main className="lab-overview" lang={language}>
      <header>
        <p className="overview-eyebrow">{t('aboutTheProject')}</p>
        <h1>{t('frontendPerformanceLab')}</h1>
        <p>{t('aHandsonProjectForUnderstandingHowFrontend')}</p>
      </header>

      <section aria-labelledby="build-heading">
        <h2 id="build-heading">{t('buildingTheProject')}</h2>
        <p className="overview-build-time">{t('builtIn3DaysWithAiSupport')}</p>
        <p>{t('theBuildBroughtTogetherAnInteractiveDemo')}</p>
        <ul className="overview-challenges">
          <li data-tone="slate">
            <strong>{t('keepingComparisonsFair')}</strong>{' '}
            {t('bothImplementationsNeedTheSameDataAnd')}
          </li>
          <li data-tone="slate">
            <strong>{t('isolatingEachBottleneck')}</strong>{' '}
            {t('listRenderingSearchWorkersRequestsAndMemory')}
          </li>
          <li data-tone="teal">
            <strong>{t('largeDatasetChallengeTitle')}</strong>{' '}
            {t('largeDatasetChallengeBody')}
          </li>
          <li data-tone="clay">
            <strong>{t('timeoutChallengeTitle')}</strong>{' '}
            {t('timeoutChallengeBody')}
          </li>
          <li data-tone="clay">
            <strong>{t('layerizeChallengeTitle')}</strong>{' '}
            {t('layerizeChallengeBody')}
          </li>
          <li data-tone="clay">
            <strong>{t('e2eChallengeTitle')}</strong> {t('e2eChallengeBody')}
          </li>
          <li data-tone="teal">
            <strong>{t('gettingLifecycleCleanupRight')}</strong>{' '}
            {t('requestsTimersListenersAndRetainedDomReferences')}
          </li>
          <li data-tone="slate">
            <strong>{t('environmentChallengeTitle')}</strong>{' '}
            {t('environmentChallengeBody')}
          </li>
          <li data-tone="slate">
            <strong>{t('turningObservationsIntoCredibleEvidence')}</strong>{' '}
            {t('reproducibleRunsValidationAndTraceableArtifactsMatter')}
          </li>
          <li data-tone="teal">
            <strong>{t('publicationChallengeTitle')}</strong>{' '}
            {t('publicationChallengeBody')}
          </li>
          <li data-tone="clay">
            <strong>{t('aiCollaborationChallengeTitle')}</strong>{' '}
            {t('aiCollaborationChallengeBody')}
          </li>
        </ul>
      </section>

      <section aria-labelledby="purpose-heading">
        <h2 id="purpose-heading">{t('whatThisProjectIsDesignedToDo')}</h2>
        <p>{t('theLabUsesALiveMarketExplorer')}</p>
        <p>{t('exploreLargeListsSearchResponsivenessWorkerAggregation')}</p>
      </section>

      <section aria-labelledby="explorer-roles-heading">
        <h2 id="explorer-roles-heading">
          {t('referenceBaselineAndOptimized')}
        </h2>
        <p>{t('theThreeExplorersServeDifferentPurposesStart')}</p>
        <ul className="overview-scenarios">
          <li data-tone="slate">
            <h3>{t('referenceLearnTheExpectedBehavior')}</h3>
            <p>{t('useThisAsAFunctionalReferenceFor')}</p>
            <p>{t('trySearchingForMarket1SortingBy')}</p>
            <Link href="/reference?seed=20260911&count=60" prefetch={false}>
              {t('openReferenceExplorer')}
            </Link>
          </li>
          <li data-tone="clay">
            <h3>{t('baselineInspectTheComparisonStartingPoint')}</h3>
            <p>{t('thisIsTheControlImplementationForThe')}</p>
          </li>
          <li data-tone="teal">
            <h3>{t('optimizedExploreATargetedChange')}</h3>
            <p>{t('thisImplementsTheApproachBeingTestedFor')}</p>
          </li>
        </ul>
      </section>

      <ScenarioGuide />
    </main>
  );
}
