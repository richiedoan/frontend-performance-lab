import { isDeepStrictEqual } from 'node:util';
import type { EnvironmentObservation } from './environment.ts';
export const budgetMetrics = {
  'initial-js-bytes': { unit: 'bytes', direction: 'lower-is-better' },
  'long-task-count': { unit: 'count', direction: 'lower-is-better' },
  'dom-node-count': { unit: 'count', direction: 'lower-is-better' },
  'search-duration': { unit: 'ms', direction: 'lower-is-better' },
} as const;
export type BudgetMetric = keyof typeof budgetMetrics;
export type CheckedMetric =
  | {
      status: 'measured';
      value: number;
      unit: string;
      extraction: string;
      evidencePath: string;
    }
  | { status: 'unavailable' | 'invalid'; reason: string };
export interface VerifiedSummary {
  sha256: string;
  approach: 'baseline' | 'optimized';
  experiment: string;
  workload: { id: string; version: string; actionsSha256: string };
  environment: EnvironmentObservation;
  metrics: Partial<Record<BudgetMetric, CheckedMetric>>;
}
export function comparableEnvironment(e: EnvironmentObservation) {
  // Source/build may differ between revisions. All measured conditions must match.
  return {
    nodeVersion: e.nodeVersion,
    yarnVersion: e.yarnVersion,
    playwrightVersion: e.playwrightVersion,
    browser: {
      version: e.browser.version,
      revision: e.browser.revision,
      sha256: e.browser.sha256,
      distribution: e.browser.distribution,
    },
    os: e.os,
    viewport: e.viewport,
    locale: e.locale,
    timezoneId: e.timezoneId,
    online: e.online,
    applied: e.applied,
    storage: e.storage,
    dataset: e.dataset,
    plan: e.plan,
  };
}
export function compareBudgets(
  candidate: VerifiedSummary,
  reference: VerifiedSummary,
  metrics: BudgetMetric[],
  tolerance = 0,
  approvedReferenceSha256?: string,
) {
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 1)
    throw new Error('Tolerance must be a fraction between 0 and 1');
  if (
    !metrics.length ||
    new Set(metrics).size !== metrics.length ||
    metrics.some((metric) => !Object.hasOwn(budgetMetrics, metric))
  )
    throw new Error('Select distinct known metrics');
  let incompatible: string | undefined;
  if (candidate.approach !== 'optimized')
    incompatible = 'Candidate must be optimized';
  else if (
    reference.approach !== 'baseline' &&
    reference.sha256 !== approvedReferenceSha256
  )
    incompatible =
      'Optimized reference requires its explicitly approved summary SHA-256';
  else if (
    candidate.experiment !== reference.experiment ||
    !isDeepStrictEqual(candidate.workload, reference.workload)
  )
    incompatible = 'Incompatible experiment/workload';
  else if (
    !isDeepStrictEqual(
      comparableEnvironment(candidate.environment),
      comparableEnvironment(reference.environment),
    )
  )
    incompatible = 'Incompatible environment';
  const results = metrics.map((metric) => {
    const policy = budgetMetrics[metric];
    const base = {
      metric,
      ...policy,
      tolerance,
      aggregation: 'median',
      expectedSampleCount: 5,
    };
    if (incompatible)
      return { ...base, status: 'invalid', reason: incompatible };
    const c = candidate.metrics[metric];
    const r = reference.metrics[metric];
    if (c?.status === 'invalid' || r?.status === 'invalid')
      return {
        ...base,
        status: 'invalid',
        reason: [c, r]
          .filter((v) => v?.status === 'invalid')
          .map((v) => (v as { reason: string }).reason)
          .join('; '),
      };
    if (c?.status !== 'measured' || r?.status !== 'measured')
      return {
        ...base,
        status: 'unavailable',
        reason:
          'Candidate/reference missing: ' +
          [c, r]
            .map((v) =>
              v && v.status !== 'measured'
                ? v.reason
                : v
                  ? 'measured'
                  : 'absent',
            )
            .join('; '),
      };
    if (
      c.unit !== policy.unit ||
      r.unit !== policy.unit ||
      c.extraction !== r.extraction
    )
      return {
        ...base,
        status: 'invalid',
        reason: 'Incompatible unit or extraction boundary',
      };
    if (
      ![c.value, r.value].every((value) => Number.isFinite(value) && value >= 0)
    )
      return { ...base, status: 'invalid', reason: 'Invalid numeric value' };
    const limit = r.value * (1 + tolerance);
    if (!Number.isFinite(limit))
      return { ...base, status: 'invalid', reason: 'Numeric overflow' };
    // Only compensate floating-point rounding at the inclusive threshold, not measurement noise.
    const rounding =
      Number.EPSILON * Math.max(Math.abs(limit), Math.abs(c.value)) * 4;
    return {
      ...base,
      status: c.value <= limit + rounding ? 'pass' : 'regression',
      candidate: c.value,
      reference: r.value,
      limit,
      relativeChange: r.value === 0 ? null : (c.value - r.value) / r.value,
      evidencePaths: [c.evidencePath, r.evidencePath],
    };
  });
  const status =
    ['invalid', 'unavailable', 'regression'].find((status) =>
      results.some((result) => result.status === status),
    ) ?? 'pass';
  return {
    status,
    candidateSha256: candidate.sha256,
    referenceSha256: reference.sha256,
    results,
  };
}
