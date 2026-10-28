import publishedInputs from './published-runs.json' with { type: 'json' };
import type { ExperimentRun } from '../types/experiment';
import { plannedDefinitions } from '../definitions/planned';
import {
  parseExperimentDefinition,
  parseExperimentRun,
} from '../validation/experiment';
import { run as largeList } from '../runs/large-list';
import { run as searchInput } from '../runs/search-input';
import { run as workerAggregation } from '../runs/worker-aggregation';
import { run as renderBoundary } from '../runs/render-boundary';
import { run as requestLifecycle } from '../runs/request-lifecycle';
import { run as bundleLoading } from '../runs/bundle-loading';
import { run as imageFont } from '../runs/image-font';
import { run as intervalMemoryLeak } from '../runs/interval-memory-leak';
import { run as listenerMemoryLeak } from '../runs/listener-memory-leak';
import { run as detachedDomMemoryLeak } from '../runs/detached-dom-memory-leak';

export function buildExperimentRegistry(
  definitionInputs: unknown[],
  runInputs: unknown[],
) {
  const definitions = definitionInputs.map(parseExperimentDefinition);
  const runs = runInputs.map((input) => {
    const experimentId = (input as { experimentId?: unknown } | null)
      ?.experimentId;
    const definition = definitions.find((item) => item.id === experimentId);
    if (!definition) throw new Error('Unknown experiment ID');
    return parseExperimentRun(input, definition);
  });
  if (new Set(runs.map((run) => run.id)).size !== runs.length)
    throw new Error('Duplicate run ID');
  if (new Set(definitions.map((d) => d.id)).size !== definitions.length)
    throw new Error('Duplicate experiment ID');
  return definitions.map((definition) => ({
    definition,
    runs: runs.filter((run) => run.experimentId === definition.id),
  }));
}

export function getExperimentRegistry(
  publishedRuns: ExperimentRun[] = publishedInputs as ExperimentRun[],
) {
  const inputs = [
    largeList,
    searchInput,
    workerAggregation,
    renderBoundary,
    requestLifecycle,
    bundleLoading,
    imageFont,
    intervalMemoryLeak,
    listenerMemoryLeak,
    detachedDomMemoryLeak,
  ];
  const definitions = plannedDefinitions.map((definition) =>
    publishedRuns.some((run) => run.experimentId === definition.id)
      ? {
          ...definition,
          metrics: [
            ...definition.metrics,
            { id: 'journey-duration', unit: 'ms' as const },
          ],
        }
      : definition,
  );
  return buildExperimentRegistry(definitions, [
    ...inputs.map((run) => {
      parseExperimentRun(
        run,
        plannedDefinitions.find((item) => item.id === run.experimentId)!,
      );
      const definition = definitions.find(
        (item) => item.id === run.experimentId,
      )!;
      return {
        ...run,
        results: definition.approaches.flatMap(({ id: approach }) =>
          definition.metrics.map(
            ({ id: metricId }) =>
              run.results.find(
                (entry) =>
                  entry.approach === approach && entry.metricId === metricId,
              ) ?? {
                approach,
                metricId,
                result: {
                  status: 'not-available',
                  reason: 'No result recorded for this collection.',
                },
              },
          ),
        ),
      };
    }),
    ...publishedRuns,
  ]);
}
