import type {
  ExperimentDefinition,
  ExperimentRun,
  MeasuredValue,
} from '../types/experiment';
export interface CaseStudyRecord {
  definition: ExperimentDefinition;
  runs: ExperimentRun[];
}
function chartGroup(metric: string, extraction: string, unit: string) {
  if (
    (['lcp', 'largest-contentful-paint'].includes(metric) && unit === 'ms') ||
    (['layout-shift', 'cls'].includes(metric) && unit === 'score')
  )
    return 'Core Web Vitals — lab';
  if (
    ['retained-heap', 'detached-nodes'].includes(metric) &&
    extraction.startsWith('repeated-navigation/')
  )
    return 'Repeated-navigation memory';
  if (
    [
      'journey-duration',
      'dom-nodes',
      'search-duration',
      'aggregation-duration',
      'render-count',
      'request-count',
      'initial-javascript',
      'long-task-count',
      'tbt',
      'speed-index',
    ].includes(metric)
  )
    return 'Runtime — lab';
  return null;
}
/** Input must come from readCaseStudyRun; never joins values from different runs/environments. */
export function summarizeCaseStudy(records: CaseStudyRecord[]) {
  return records.map(({ definition, runs }) => ({
    id: definition.id,
    title: definition.title,
    purpose: definition.hypothesis,
    variable: definition.primaryVariable,
    approaches: definition.approaches,
    runs: runs.map((run) => ({
      id: run.id,
      reason: run.reason,
      environment: run.environment,
      metrics: definition.metrics
        .filter((metric) => !/inp/i.test(metric.id))
        .map((metric) => {
          const get = (approach: 'baseline' | 'optimized') =>
            run.results.find(
              (entry) =>
                entry.approach === approach && entry.metricId === metric.id,
            )?.result ?? {
              status: 'not-available' as const,
              reason: 'No result recorded.',
            };
          const baseline = get('baseline');
          const optimized = get('optimized');
          const valid = (value: typeof baseline): value is MeasuredValue =>
            value.status === 'measured' &&
            value.aggregation === 'median' &&
            value.sampleCount === 5 &&
            value.unit === metric.unit &&
            Number.isFinite(value.value) &&
            value.value >= 0;
          const compatible =
            run.status === 'recorded' &&
            !('status' in run.environment) &&
            valid(baseline) &&
            valid(optimized) &&
            baseline.extraction === optimized.extraction;
          const group = compatible
            ? chartGroup(metric.id, baseline.extraction, metric.unit)
            : null;
          return {
            id: metric.id,
            unit: metric.unit,
            baseline,
            optimized,
            compatible,
            group,
            comparison:
              compatible && baseline.value > 0
                ? ((baseline.value - optimized.value) / baseline.value) * 100
                : null,
            limitation: !compatible
              ? 'Comparison unavailable: requires verified medians of five samples, one environment, identical units and extraction boundaries.'
              : baseline.value === 0
                ? 'Percentage unavailable because baseline is zero.'
                : 'Relative change only; five samples do not establish statistical significance.',
          };
        }),
    })),
  }));
}
export type CaseStudyView = ReturnType<typeof summarizeCaseStudy>;
