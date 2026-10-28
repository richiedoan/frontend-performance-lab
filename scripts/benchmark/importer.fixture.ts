// Synthetic inputs for unit tests only; never written to the production catalog.
import { profile, type EnvironmentObservation } from './environment';
import { journeyReadinessPolicy } from './dataset-readiness';
import { schedule, summarize, type Iteration } from './runner-model';
import {
  generateMarketRecords,
  MARKET_GENERATOR_VERSION,
} from '../../src/features/market/data/generate-market-records';
import { hash } from '../publication/files';
export function collectionFixture() {
  const identity = {
    sourceRevision: 'c'.repeat(40),
    lockfileSha256: hash('fixture-lock'),
    pipelineId: '100',
    jobId: '200',
  };
  const observed: EnvironmentObservation = {
    nodeVersion: profile.nodeVersion,
    yarnVersion: profile.yarnVersion,
    playwrightVersion: profile.playwrightVersion,
    browser: {
      version: profile.chromeVersion,
      revision: profile.chromeRevision,
      distribution: 'Chrome for Testing',
      executable: '/fixture/chrome',
      sha256: 'a'.repeat(64),
      product: `HeadlessChrome/${profile.chromeVersion}`,
    },
    viewport: { ...profile.viewport },
    locale: profile.locale,
    timezoneId: profile.timezoneId,
    online: true,
    reducedMotion: false,
    applied: {
      cpuRate: profile.cpuRate,
      network: { ...profile.network },
      cacheDisabled: true,
      cacheCleared: true,
      freshContext: true,
      serviceWorkers: 'block',
      headless: true,
    },
    storage: { cookies: 0, origins: 0 },
    dataset: {
      seed: profile.seed,
      recordCount: profile.recordCount,
      generatorVersion: MARKET_GENERATOR_VERSION,
      schemaVersion: 1,
      sha256: hash(
        JSON.stringify(
          generateMarketRecords({
            seed: profile.seed,
            count: profile.recordCount,
          }),
        ),
      ),
    },
    source: {
      commitSha: identity.sourceRevision,
      dirty: false,
      status: '',
      patchSha256: hash(''),
    },
    os: {
      platform: 'fixture',
      release: 'fixture',
      arch: 'fixture',
      cpu: 'fixture',
      totalMemory: 1024,
    },
    plan: {
      measuredIterations: 5,
      warmupIterations: 0,
      cacheState: profile.cacheState,
    },
  };
  const samples: Iteration[] = schedule(['baseline', 'optimized']).map(
    (slot) => ({
      ...slot,
      evidencePath: `${slot.route}-${slot.iteration}.json`,
      status: 'passed',
      value: slot.iteration * (slot.route === 'baseline' ? 100 : 50),
    }),
  );
  const files: Record<string, unknown> = {
    'manifest.json': {
      id: 'synthetic-collection',
      provenance: identity,
      experiment: 'large-list',
      routes: ['baseline', 'optimized'],
      dryRun: false,
      collector: 'journey',
      profile,
      readinessPolicy: journeyReadinessPolicy,
      schedule: schedule(['baseline', 'optimized']),
      warmupPolicy: 'zero warm-up iterations (mobile-cold-v1)',
      metric:
        'dashboard-detail-dashboard journey duration, ms, Node monotonic clock; includes automation and network waits',
      environmentPath: 'environment/environment.json',
    },
    'environment/environment.json': {
      schemaVersion: 1,
      profileId: profile.id,
      recordedAt: '2026-09-14T00:00:00.000Z',
      status: 'passed',
      observed,
      failures: [],
      limitations: [],
    },
    'build.json': {
      sourceRevision: identity.sourceRevision,
      lockfileSha256: identity.lockfileSha256,
      mode: 'production',
      command: 'yarn build',
      buildId: 'fixture-build',
    },
    'summary.json': {
      status: 'completed',
      readinessPolicy: journeyReadinessPolicy,
      metric:
        'dashboard-detail-dashboard journey duration (automation-inclusive)',
      rawInputs: samples.map((s) => s.evidencePath),
      routes: {
        baseline: summarize(samples, 'baseline'),
        optimized: summarize(samples, 'optimized'),
      },
    },
  };
  for (const [index, sample] of samples.entries())
    files[sample.evidencePath] = {
      ...sample,
      unit: 'ms',
      startedAt: new Date(
        Date.parse('2026-09-14T00:00:00.000Z') + index * 2000,
      ).toISOString(),
      endedAt: new Date(
        Date.parse('2026-09-14T00:00:00.000Z') + index * 2000 + 1000,
      ).toISOString(),
      observed,
      errors: [],
      readinessPolicy: journeyReadinessPolicy,
      phase: 'drawer-journey',
      timings: {
        datasetReadyMs: 10,
        tableReadyMs: 20,
        journeyMs: sample.status === 'passed' ? sample.value : 0,
      },
      scenario: 'large-list',
      seed: profile.seed,
      recordCount: profile.recordCount,
    };
  return { files: structuredClone(files), identity };
}
