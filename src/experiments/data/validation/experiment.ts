import type { ExperimentDefinition, ExperimentRun } from '../types/experiment';

type Check = (value: unknown, path: string) => void;
function fail(path: string): never {
  throw new Error(`Invalid experiment record: ${path}`);
}
const text: Check = (v, p) => {
  if (typeof v !== 'string' || !v.trim()) fail(p);
};
const number: Check = (v, p) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(p);
};
const nonnegative: Check = (v, p) => {
  number(v, p);
  if ((v as number) < 0) fail(p);
};
const integer: Check = (v, p) => {
  nonnegative(v, p);
  if (!Number.isSafeInteger(v)) fail(p);
};
const positive: Check = (v, p) => {
  integer(v, p);
  if (v === 0) fail(p);
};
const choice =
  (...values: unknown[]): Check =>
  (v, p) => {
    if (!values.includes(v)) fail(p);
  };
const object =
  (fields: Record<string, Check>): Check =>
  (v, p) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) fail(p);
    const record = v as Record<string, unknown>;
    if (Object.keys(record).some((key) => !Object.hasOwn(fields, key)))
      fail(`${p}.unknown-field`);
    for (const [key, check] of Object.entries(fields))
      check(record[key], `${p}.${key}`);
  };
const array =
  (check: Check): Check =>
  (v, p) => {
    if (!Array.isArray(v)) fail(p);
    (v as unknown[]).forEach((item, i) => check(item, `${p}[${i}]`));
  };
const union =
  (a: Check, b: Check): Check =>
  (v, p) => {
    try {
      a(v, p);
    } catch {
      b(v, p);
    }
  };
const missing = object({ status: choice('not-available'), reason: text });
const unit = choice('ms', 'bytes', 'count', 'score');
const approach = choice('baseline', 'optimized');
const hash: Check = (v, p) => {
  if (typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v)) fail(p);
};
const date: Check = (v, p) => {
  if (
    typeof v !== 'string' ||
    !Number.isFinite(Date.parse(v)) ||
    new Date(v).toISOString() !== v
  )
    fail(p);
};
const evidencePath: Check = (v, p) => {
  if (
    typeof v !== 'string' ||
    !/^evidence\/[a-zA-Z0-9_./-]+$/.test(v) ||
    v.split('/').some((part) => !part || part === '.' || part === '..')
  )
    fail(p);
};
const definition = object({
  id: text,
  title: text,
  hypothesis: text,
  primaryVariable: text,
  approaches: array(object({ id: approach, description: text })),
  metrics: array(object({ id: text, unit })),
});
const environment = object({
  sourceRevision: text,
  dirtyPatch: union(evidencePath, missing),
  lockfileSha256: hash,
  buildId: text,
  nodeVersion: text,
  packageManager: object({ name: choice('yarn'), version: text }),
  browser: text,
  browserVersion: text,
  os: text,
  cpu: text,
  memoryBytes: positive,
  viewport: object({ width: positive, height: positive }),
  cpuThrottle: positive,
  network: text,
  cache: choice('cold', 'warm'),
  reducedMotion: choice(true, false),
  dataset: object({
    seed: number,
    count: integer,
    generatorVersion: positive,
    schemaVersion: positive,
    sha256: hash,
  }),
  command: text,
});
const measured = object({
  status: choice('measured'),
  value: nonnegative,
  unit,
  aggregation: choice('single', 'median', 'mean', 'p95', 'sum'),
  sampleCount: positive,
  evidencePath,
  extraction: text,
});
const run = object({
  schemaVersion: choice(1),
  id: text,
  experimentId: text,
  status: choice('recorded', 'not-available'),
  reason: union(text, choice(null)),
  environment: union(environment, missing),
  artifacts: array(
    object({
      path: evidencePath,
      kind: choice('trace', 'profile', 'log', 'screenshot'),
      sha256: hash,
      collectedAt: date,
    }),
  ),
  results: array(
    object({ approach, metricId: text, result: union(measured, missing) }),
  ),
});

export function parseExperimentDefinition(
  input: unknown,
): ExperimentDefinition {
  definition(input, 'definition');
  const value = input as ExperimentDefinition;
  if (
    value.approaches.length !== 2 ||
    new Set(value.approaches.map((a) => a.id)).size !== 2
  )
    fail('definition.approaches');
  if (
    !value.metrics.length ||
    new Set(value.metrics.map((m) => m.id)).size !== value.metrics.length
  )
    fail('definition.metrics');
  return structuredClone(value);
}

/** Structural and reference validation, not proof that an artifact's contents support a claim. */
export function parseExperimentRun(
  input: unknown,
  experiment: ExperimentDefinition,
): ExperimentRun {
  run(input, 'run');
  const value = input as ExperimentRun;
  if (value.experimentId !== experiment.id) fail('run.experimentId');
  if (value.status === 'not-available' ? !value.reason : value.reason !== null)
    fail('run.reason');
  const paths = new Set(value.artifacts.map((a) => a.path));
  if (paths.size !== value.artifacts.length) fail('run.artifacts.duplicate');
  const seen = new Set<string>();
  for (const entry of value.results) {
    const metric = experiment.metrics.find((m) => m.id === entry.metricId);
    const key = `${entry.approach}/${entry.metricId}`;
    if (!metric || seen.has(key)) fail('run.results.metric');
    seen.add(key);
    if (entry.result.status === 'measured') {
      const result = entry.result;
      if (value.status !== 'recorded' || 'status' in value.environment)
        fail('run.results.environment');
      if (result.unit !== metric.unit) fail('run.results.unit');
      if (!paths.has(result.evidencePath)) fail('run.results.evidencePath');
      if (
        value.artifacts.find((a) => a.path === result.evidencePath)?.kind ===
        'screenshot'
      )
        fail('run.results.raw-evidence');
      if (result.aggregation === 'single' && result.sampleCount !== 1)
        fail('run.results.sampleCount');
    }
  }
  if (seen.size !== experiment.metrics.length * 2) fail('run.results.missing');
  return structuredClone(value);
}
