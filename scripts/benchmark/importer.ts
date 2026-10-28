import { plannedDefinitions } from '../../src/experiments/data/definitions/planned.ts';
import { parseExperimentRun } from '../../src/experiments/data/validation/experiment.ts';
import type { ExperimentRun } from '../../src/experiments/data/types/experiment.ts';
import {
  generateMarketRecords,
  MARKET_GENERATOR_VERSION,
} from '../../src/features/market/data/generate-market-records.ts';
import {
  checkEnvironment,
  profile,
  type EnvironmentObservation,
} from './environment.ts';
import { journeyReadinessPolicy } from './dataset-readiness.ts';
import { schedule, summarize, median, type Iteration } from './runner-model.ts';
import {
  equal,
  hash,
  jsonFile,
  readSafe,
  record,
  replaceJson,
  requireValue,
  safePath,
  writeSafe,
} from '../publication/files.ts';

export const catalogPath = 'src/experiments/data/catalog/published-runs.json';
export interface Identity {
  sourceRevision: string;
  lockfileSha256: string;
  pipelineId: string;
  jobId: string;
}
export interface ImportPlan {
  run: ExperimentRun;
  evidence: string;
}
export const definitionFor = (id: string) => {
  const definition = plannedDefinitions.find((item) => item.id === id);
  requireValue(definition, 'unknown experiment');
  return {
    ...definition,
    metrics: [
      ...definition.metrics,
      { id: 'journey-duration', unit: 'ms' as const },
    ],
  };
};
export function validateRuns(input: unknown): ExperimentRun[] {
  requireValue(Array.isArray(input), 'runs array');
  const runs = input.map((item) => {
    const value = record(item);
    return parseExperimentRun(item, definitionFor(String(value.experimentId)));
  });
  requireValue(
    new Set(runs.map((run) => run.id)).size === runs.length,
    'duplicate run ID',
  );
  requireValue(
    runs.every(
      (run) =>
        !plannedDefinitions.some((d) => run.id === `${d.id}-not-collected`),
    ),
    'reserved run ID',
  );
  return runs;
}
export async function validateCollection(
  directory: string,
  expected: Identity,
): Promise<ImportPlan> {
  requireValue(
    /^[a-f0-9]{40}$/.test(expected.sourceRevision) &&
      /^[a-f0-9]{64}$/.test(expected.lockfileSha256) &&
      /^\d+$/.test(expected.pipelineId) &&
      /^\d+$/.test(expected.jobId),
    'expected provenance',
  );
  const manifest = record(await jsonFile(directory, 'manifest.json'));
  equal(manifest.provenance, expected, 'provenance mismatch');
  requireValue(
    typeof manifest.id === 'string' && /^[a-zA-Z0-9-]+$/.test(manifest.id),
    'collection ID',
  );
  equal(manifest.routes, ['baseline', 'optimized'], 'paired approaches');
  equal(manifest.dryRun, false, 'dry collection');
  equal(manifest.collector, 'journey', 'collector');
  requireValue(!manifest.lighthouse, 'Lighthouse unsupported');
  equal(manifest.profile, profile, 'profile');
  equal(manifest.readinessPolicy, journeyReadinessPolicy, 'readiness');
  equal(manifest.schedule, schedule(['baseline', 'optimized']), 'schedule');
  equal(
    manifest.environmentPath,
    'environment/environment.json',
    'environment path',
  );
  equal(
    manifest.warmupPolicy,
    'zero warm-up iterations (mobile-cold-v1)',
    'warmup',
  );
  equal(
    manifest.metric,
    'dashboard-detail-dashboard journey duration, ms, Node monotonic clock; includes automation and network waits',
    'metric',
  );
  const definition = definitionFor(
    manifest.experiment === 'image-font-delivery'
      ? 'image-font'
      : String(manifest.experiment),
  );
  const environment = record(
    await jsonFile(directory, 'environment/environment.json'),
  );
  equal(environment.schemaVersion, 1, 'environment schema');
  equal(environment.profileId, profile.id, 'environment profile');
  equal(environment.status, 'passed', 'environment status');
  equal(environment.failures, [], 'environment failures');
  requireValue(
    typeof environment.recordedAt === 'string' &&
      Number.isFinite(Date.parse(environment.recordedAt)) &&
      new Date(environment.recordedAt).toISOString() === environment.recordedAt,
    'environment date',
  );
  const observed = record(
    environment.observed,
  ) as unknown as EnvironmentObservation;
  equal(checkEnvironment(observed), [], 'environment mismatch');
  equal(
    observed.source.commitSha,
    expected.sourceRevision,
    'environment commit',
  );
  equal(observed.source.dirty, false, 'dirty source');
  equal(observed.source.status, '', 'dirty status');
  equal(observed.source.patchSha256, hash(''), 'source patch');
  equal(observed.reducedMotion, false, 'reduced motion');
  equal(
    observed.dataset,
    {
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
    'dataset',
  );
  const build = record(await jsonFile(directory, 'build.json'));
  equal(build.sourceRevision, expected.sourceRevision, 'build commit');
  equal(build.lockfileSha256, expected.lockfileSha256, 'build lockfile');
  equal(build.mode, 'production', 'build mode');
  equal(build.command, 'yarn build', 'build command');
  requireValue(
    typeof build.buildId === 'string' && /^[a-zA-Z0-9_-]+$/.test(build.buildId),
    'build ID',
  );
  const summary = record(await jsonFile(directory, 'summary.json'));
  equal(summary.status, 'completed', 'incomplete collection');
  requireValue(
    !summary.setupFailure && !summary.collector,
    'summary failure or collector',
  );
  equal(
    summary.metric,
    'dashboard-detail-dashboard journey duration (automation-inclusive)',
    'summary metric',
  );
  equal(summary.readinessPolicy, journeyReadinessPolicy, 'summary readiness');
  const slots = schedule(['baseline', 'optimized']);
  equal(
    summary.rawInputs,
    slots.map((s) => `${s.route}-${s.iteration}.json`),
    'five distinct iterations per approach',
  );
  const samples: Iteration[] = [];
  const timings = [];
  let collectedAt = '';
  let previousEnd = Date.parse(environment.recordedAt);
  for (const slot of slots) {
    const evidencePath = `${slot.route}-${slot.iteration}.json`;
    const raw = record(await jsonFile(directory, evidencePath));
    equal(raw.route, slot.route, 'raw route');
    equal(raw.iteration, slot.iteration, 'raw iteration');
    equal(raw.evidencePath, evidencePath, 'raw path');
    equal(raw.status, 'passed', 'raw failed');
    equal(raw.unit, 'ms', 'raw unit');
    equal(raw.scenario, manifest.experiment, 'raw scenario');
    equal(raw.seed, profile.seed, 'raw seed');
    equal(raw.recordCount, profile.recordCount, 'raw count');
    equal(raw.readinessPolicy, journeyReadinessPolicy, 'raw readiness');
    equal(raw.observed, observed, 'raw environment');
    equal(raw.errors, [], 'raw errors');
    equal(raw.phase, 'drawer-journey', 'raw phase');
    requireValue(
      typeof raw.value === 'number' &&
        Number.isFinite(raw.value) &&
        raw.value >= 0,
      'raw value',
    );
    const t = record(raw.timings);
    requireValue(
      typeof t.datasetReadyMs === 'number' &&
        Number.isFinite(t.datasetReadyMs) &&
        t.datasetReadyMs >= 0 &&
        typeof t.tableReadyMs === 'number' &&
        Number.isFinite(t.tableReadyMs) &&
        t.tableReadyMs >= t.datasetReadyMs &&
        t.tableReadyMs <= raw.value,
      'raw timings',
    );
    equal(t.journeyMs, raw.value, 'journey timing');
    for (const date of [raw.startedAt, raw.endedAt])
      requireValue(
        typeof date === 'string' &&
          Number.isFinite(Date.parse(date)) &&
          new Date(date).toISOString() === date,
        'raw date',
      );
    requireValue(
      Date.parse(String(raw.endedAt)) >= Date.parse(String(raw.startedAt)),
      'raw chronology',
    );
    requireValue(
      Date.parse(String(raw.startedAt)) >= previousEnd &&
        Date.parse(String(raw.endedAt)) > Date.parse(String(raw.startedAt)),
      'overlapping or duplicated iteration timestamps',
    );
    previousEnd = Date.parse(String(raw.endedAt));
    collectedAt = String(raw.endedAt);
    samples.push({ ...slot, evidencePath, status: 'passed', value: raw.value });
    timings.push({
      ...slot,
      startedAt: raw.startedAt,
      endedAt: raw.endedAt,
      datasetReadyMs: t.datasetReadyMs,
      tableReadyMs: t.tableReadyMs,
      journeyMs: t.journeyMs,
    });
  }
  const routes = {
    baseline: summarize(samples, 'baseline'),
    optimized: summarize(samples, 'optimized'),
  };
  equal(summary.routes, routes, 'summary median or metadata mismatch');
  const id = `ci-${expected.pipelineId}-${expected.jobId}-${manifest.id}`;
  const path = safePath(`evidence/${id}/journey.json`);
  const env: ExperimentRun['environment'] = {
    sourceRevision: expected.sourceRevision,
    lockfileSha256: expected.lockfileSha256,
    buildId: build.buildId,
    dirtyPatch: { status: 'not-available', reason: 'Clean source; no patch.' },
    nodeVersion: observed.nodeVersion,
    packageManager: { name: 'yarn', version: observed.yarnVersion },
    browser: observed.browser.distribution,
    browserVersion: observed.browser.version,
    os: `${observed.os.platform} ${observed.os.release} ${observed.os.arch}`,
    cpu: observed.os.cpu,
    memoryBytes: observed.os.totalMemory,
    viewport: {
      width: observed.viewport.width,
      height: observed.viewport.height,
    },
    cpuThrottle: profile.cpuRate,
    network: JSON.stringify(profile.network),
    cache: 'cold',
    reducedMotion: false,
    dataset: {
      seed: observed.dataset.seed,
      count: observed.dataset.recordCount,
      generatorVersion: observed.dataset.generatorVersion,
      schemaVersion: 1,
      sha256: observed.dataset.sha256,
    },
    command: `yarn benchmark:compare ${manifest.experiment}`,
  };
  // Deliberately exclude logs, executable paths, arbitrary errors and source patches.
  const evidence =
    JSON.stringify(
      {
        schemaVersion: 1,
        collectionId: manifest.id,
        provenance: expected,
        metric: summary.metric,
        unit: 'ms',
        environment: env,
        readinessPolicy: journeyReadinessPolicy,
        schedule: slots,
        samples,
        timings,
        routes,
      },
      null,
      2,
    ) + '\n';
  const run: ExperimentRun = {
    schemaVersion: 1,
    id,
    experimentId: definition.id,
    status: 'recorded',
    reason: null,
    environment: env,
    artifacts: [{ path, kind: 'log', sha256: hash(evidence), collectedAt }],
    results: definition.approaches.flatMap(({ id: approach }) =>
      definition.metrics.map(({ id: metricId }) => ({
        approach,
        metricId,
        result:
          metricId === 'journey-duration'
            ? {
                status: 'measured' as const,
                value: median(
                  samples
                    .filter((sample) => sample.route === approach)
                    .map((sample) =>
                      sample.status === 'passed' ? sample.value : NaN,
                    ),
                ),
                unit: 'ms' as const,
                aggregation: 'median' as const,
                sampleCount: 5,
                evidencePath: path,
                extraction:
                  'Median of five distinct raw journey durations; automation-inclusive Node monotonic timing including network waits. Not INP or LCP.',
              }
            : {
                status: 'not-available' as const,
                reason:
                  'Not collected by the automation-inclusive journey collector.',
              },
      })),
    ),
  };
  return { run: parseExperimentRun(run, definition), evidence };
}
export function mergeRuns(
  existing: ExperimentRun[],
  incoming: ExperimentRun[],
) {
  const merged = [...existing];
  for (const run of incoming) {
    const previous = merged.find((item) => item.id === run.id);
    if (previous) equal(previous, run, 'run identity conflict');
    else merged.push(run);
  }
  return validateRuns(merged);
}
export async function importPlan(
  root: string,
  plan: ImportPlan,
  dryRun: boolean,
  history: ExperimentRun[] = [],
) {
  const current = validateRuns(await jsonFile(root, catalogPath));
  const runs = mergeRuns(mergeRuns(current, history), [plan.run]);
  for (const run of mergeRuns(current, history))
    for (const artifact of run.artifacts)
      equal(
        hash(await readSafe(`${root}/public`, artifact.path)),
        artifact.sha256,
        'existing evidence checksum',
      );
  try {
    equal(
      await readSafe(`${root}/public`, plan.run.artifacts[0].path),
      plan.evidence,
      'existing evidence conflict',
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (!dryRun) {
    await writeSafe(
      `${root}/public`,
      plan.run.artifacts[0].path,
      plan.evidence,
    );
    await replaceJson(root, catalogPath, runs);
  }
  await replaceJson(root, 'reports/publication-import.json', {
    status: dryRun ? 'validated' : 'imported',
    runId: plan.run.id,
  });
  return runs;
}
