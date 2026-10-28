import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { profile } from './environment.ts';
export const experiments = [
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
export type Route = 'baseline' | 'optimized';
export interface Options {
  experiment: string;
  routes: Route[];
  dryRun: boolean;
  lighthouse?: boolean;
}
export function parseOptions(args: string[], compare = false): Options {
  const [experiment, ...flags] = args;
  if (!experiments.includes(experiment as (typeof experiments)[number]))
    throw new Error('Unknown experiment');
  if (
    new Set(flags).size !== flags.length ||
    flags.some(
      (flag) =>
        ![
          '--dry-run',
          '--route=baseline',
          '--route=optimized',
          '--lighthouse',
        ].includes(flag),
    )
  )
    throw new Error('Unknown or duplicate option');
  const routes = flags.filter((flag) => flag.startsWith('--route='));
  if (compare ? routes.length !== 0 : routes.length !== 1)
    throw new Error(
      compare
        ? 'Compare selects both routes'
        : 'Supply exactly one --route=baseline|optimized',
    );
  return {
    experiment,
    routes: compare ? ['baseline', 'optimized'] : [routes[0].slice(8) as Route],
    dryRun: flags.includes('--dry-run'),
    ...(flags.includes('--lighthouse') ? { lighthouse: true } : {}),
  };
}
export function schedule(routes: Route[]) {
  return Array.from({ length: profile.measuredIterations }, (_, index) =>
    (index % 2 ? [...routes].reverse() : routes).map((route) => ({
      route,
      iteration: index + 1,
    })),
  ).flat();
}
export function median(values: number[]): number {
  if (!values.length || values.some((value) => !Number.isFinite(value)))
    throw new Error('Median requires finite samples');
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}
export type Iteration = {
  route: Route;
  iteration: number;
  evidencePath: string;
} & (
  { status: 'passed'; value: number } | { status: 'failed'; reason: string }
);
export function summarize(results: Iteration[], route: Route) {
  const samples = results.filter((result) => result.route === route);
  const passed = samples.filter((result) => result.status === 'passed');
  const common = {
    unit: 'ms',
    aggregation: 'median',
    sampleCount: passed.length,
    expectedSampleCount: profile.measuredIterations,
    evidencePaths: samples.map((sample) => sample.evidencePath),
  };
  if (
    samples.length !== profile.measuredIterations ||
    passed.length !== samples.length ||
    new Set(samples.map((sample) => sample.iteration)).size !==
      profile.measuredIterations
  )
    return {
      ...common,
      status: 'not-available',
      reason:
        'Five distinct successful iterations are required; all failures and partial results are retained.',
    };
  return {
    ...common,
    status: 'measured',
    value: median(passed.map((sample) => sample.value)),
  };
}
export async function createEvidence(root: string) {
  await mkdir(root, { recursive: true });
  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`;
  const directory = join(root, id);
  await mkdir(directory); // Exclusive: never reuse an existing run.
  return { id, directory };
}
export async function writeEvidence(
  directory: string,
  name: string,
  value: unknown,
) {
  if (!/^[a-z0-9-]+\.json$/.test(name))
    throw new Error('Unsafe evidence filename');
  await writeFile(
    join(directory, name),
    JSON.stringify(value, null, 2) + '\n',
    { flag: 'wx' },
  );
}
