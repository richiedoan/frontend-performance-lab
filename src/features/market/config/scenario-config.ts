import {
  DEFAULT_AGGREGATION_PASSES,
  parseAggregationPasses,
} from '../worker-aggregation/aggregate';
import { parseMarketOptions } from './market-options';

export const SCENARIOS = [
  'default',
  'large-list',
  'search-input',
  'worker-aggregation',
  'render-boundary',
  'request-lifecycle',
  'bundle-loading',
  'image-font-delivery',
  'interval-memory-leak',
  'listener-memory-leak',
  'detached-dom-memory-leak',
] as const;
export type Scenario = (typeof SCENARIOS)[number];
export interface ScenarioConfig {
  scenario: Scenario | 'optimized-explorer';
  seed: number;
  count: number;
  delayMs: number;
  simulateError: boolean;
  aggregationPasses: number;
}
export type ScenarioConfigResult =
  | { status: 'valid'; config: ScenarioConfig; apiQuery: string }
  | { status: 'invalid'; message: string };

export function isOptimizedExplorerEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_OPTIMIZE === '1';
}

export function parseScenarioConfig(
  query: string,
  allowOptimizedExplorer = false,
): ScenarioConfigResult {
  try {
    const params = new URLSearchParams(query);
    const requestedScenario = params.get('scenario') ?? 'default';
    const scenario =
      allowOptimizedExplorer && requestedScenario === 'default'
        ? 'optimized-explorer'
        : requestedScenario;
    const combined =
      allowOptimizedExplorer && scenario === 'optimized-explorer';
    if (
      params.getAll('scenario').length > 1 ||
      (!combined && !SCENARIOS.includes(scenario as Scenario))
    )
      throw new Error('scenario must be one of: ' + SCENARIOS.join(', '));
    const passValues = params.getAll('aggregationPasses');
    if (
      passValues.length > 1 ||
      (passValues.length && scenario !== 'worker-aggregation' && !combined)
    )
      throw new Error(
        'aggregationPasses is allowed once, only for worker-aggregation',
      );
    const aggregationPasses = passValues.length
      ? parseAggregationPasses(passValues[0])
      : DEFAULT_AGGREGATION_PASSES;
    params.delete('aggregationPasses');
    params.delete('scenario');
    const { seed, count, delayMs, simulateError } = parseMarketOptions(
      `http://local/?${params}`,
    );
    const apiQuery = new URLSearchParams({
      seed: String(seed),
      count: String(count),
      delayMs: String(delayMs),
      simulateError: String(simulateError),
    }).toString();
    return {
      status: 'valid',
      config: {
        scenario: scenario as ScenarioConfig['scenario'],
        aggregationPasses,
        seed,
        count,
        delayMs,
        simulateError,
      },
      apiQuery,
    };
  } catch (error) {
    return {
      status: 'invalid',
      message:
        error instanceof Error
          ? error.message
          : 'Invalid scenario configuration',
    };
  }
}
