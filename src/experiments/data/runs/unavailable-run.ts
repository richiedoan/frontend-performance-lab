import type { ExperimentRun } from '../types/experiment';

/** A planned placeholder, not an attempted benchmark. */
export function unavailableRun(
  experimentId: string,
  metricId: string,
): ExperimentRun {
  const reason = 'No benchmark has been collected for this planned experiment.';
  return {
    schemaVersion: 1,
    id: `${experimentId}-not-collected`,
    experimentId,
    status: 'not-available',
    reason,
    environment: {
      status: 'not-available',
      reason: 'No measurement environment has been captured.',
    },
    artifacts: [],
    results: (['baseline', 'optimized'] as const).map((approach) => ({
      approach,
      metricId,
      result: { status: 'not-available', reason },
    })),
  };
}
