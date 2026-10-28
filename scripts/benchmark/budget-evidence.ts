import { readFile, lstat, realpath } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  checkEnvironment,
  type EnvironmentObservation,
} from './environment.ts';
import { median } from './runner-model.ts';
import {
  budgetMetrics,
  type BudgetMetric,
  type CheckedMetric,
  type VerifiedSummary,
} from './budget.ts';
const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
function obj(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected object');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error('Missing text');
  return value;
}
export async function verifiedFile(root: string, input: unknown) {
  const ref = obj(input);
  const path = text(ref.path);
  if (
    !/^[a-zA-Z0-9_./-]+$/.test(path) ||
    path.split('/').some((p) => !p || p === '.' || p === '..')
  )
    throw new Error('Unsafe evidence path');
  if (typeof ref.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(ref.sha256))
    throw new Error('Invalid evidence hash');
  let current = root;
  for (const part of path.split('/')) {
    current = join(current, part);
    if ((await lstat(current)).isSymbolicLink())
      throw new Error('Symlink evidence rejected');
  }
  if (!(await lstat(current)).isFile())
    throw new Error('Evidence is not a file');
  const bytes = await readFile(current);
  if (hash(bytes) !== ref.sha256) throw new Error('Evidence checksum mismatch');
  return {
    value: JSON.parse(bytes.toString()) as unknown,
    path,
    sha256: ref.sha256,
  };
}
export async function loadVerifiedSummary(
  filename: string,
): Promise<VerifiedSummary> {
  const bytes = await readFile(filename);
  const summary = obj(JSON.parse(bytes.toString()));
  if (
    summary.schemaVersion !== 1 ||
    summary.kind !== 'regression-budget-summary' ||
    summary.evidenceKind !== 'real' ||
    !['baseline', 'optimized'].includes(String(summary.approach))
  )
    throw new Error(
      'Unsupported summary schema/approach; fixtures are not real evidence',
    );
  const root = await realpath(dirname(filename));
  const envFile = await verifiedFile(root, summary.environment);
  const env = obj(envFile.value);
  if (
    env.status !== 'passed' ||
    !Array.isArray(env.failures) ||
    env.failures.length ||
    env.schemaVersion !== 1
  )
    throw new Error('Environment preflight not passed');
  const environment = obj(env.observed) as unknown as EnvironmentObservation;
  const mismatches = checkEnvironment(environment);
  if (mismatches.length)
    throw new Error('Invalid environment: ' + mismatches.join('; '));
  const workload = obj(summary.workload);
  text(workload.id);
  text(workload.version);
  if (
    typeof workload.actionsSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(workload.actionsSha256)
  )
    throw new Error('Missing workload identity');
  const entries = obj(summary.metrics);
  const metrics: Partial<Record<BudgetMetric, CheckedMetric>> = {};
  if (Object.keys(entries).some((key) => !Object.hasOwn(budgetMetrics, key)))
    throw new Error('Unknown metric; implicit aliases are forbidden');
  for (const [key, input] of Object.entries(entries)) {
    const metric = key as BudgetMetric;
    try {
      const entry = obj(input);
      if (entry.status === 'not-available') {
        metrics[metric] = { status: 'unavailable', reason: text(entry.reason) };
        continue;
      }
      if (
        entry.status !== 'measured' ||
        entry.aggregation !== 'median' ||
        entry.sampleCount !== 5 ||
        entry.unit !== budgetMetrics[metric].unit ||
        typeof entry.value !== 'number' ||
        !Number.isFinite(entry.value) ||
        entry.value < 0
      )
        throw new Error('Invalid metric metadata/value');
      const extraction = text(entry.extraction);
      const rawFile = await verifiedFile(root, entry.evidence);
      const raw = obj(rawFile.value);
      if (
        raw.evidenceKind !== 'real' ||
        raw.metric !== metric ||
        raw.unit !== entry.unit ||
        raw.extraction !== extraction ||
        raw.approach !== summary.approach ||
        raw.experiment !== summary.experiment ||
        raw.environmentSha256 !== envFile.sha256 ||
        !isDeepStrictEqual(raw.workload, workload)
      )
        throw new Error('Raw evidence identity mismatch');
      if (!Array.isArray(raw.samples) || raw.samples.length !== 5) {
        metrics[metric] = {
          status: 'unavailable',
          reason: 'Five raw iterations required',
        };
        continue;
      }
      const samples = raw.samples.map(obj);
      if (
        new Set(samples.map((s) => s.iteration)).size !== 5 ||
        samples.some(
          (s) =>
            !Number.isInteger(s.iteration) ||
            Number(s.iteration) < 1 ||
            Number(s.iteration) > 5,
        )
      )
        throw new Error('Invalid/duplicate iteration IDs');
      if (samples.some((s) => !['passed', 'failed'].includes(String(s.status))))
        throw new Error('Invalid sample status');
      if (samples.some((s) => s.status === 'failed')) {
        samples
          .filter((s) => s.status === 'failed')
          .forEach((s) => text(s.reason));
        metrics[metric] = {
          status: 'unavailable',
          reason: 'Failed raw iteration retained; no partial median',
        };
        continue;
      }
      const values = samples.map((s) => {
        if (
          typeof s.value !== 'number' ||
          !Number.isFinite(s.value) ||
          s.value < 0 ||
          (metric !== 'search-duration' && !Number.isSafeInteger(s.value))
        )
          throw new Error('Invalid raw sample value');
        return s.value;
      });
      if (entry.value !== median(values))
        throw new Error('Summary median differs from raw evidence');
      metrics[metric] = {
        status: 'measured',
        value: entry.value,
        unit: budgetMetrics[metric].unit,
        extraction,
        evidencePath: rawFile.path,
      };
    } catch (error) {
      metrics[metric] = {
        status:
          (error as NodeJS.ErrnoException).code === 'ENOENT'
            ? 'unavailable'
            : 'invalid',
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return {
    sha256: hash(bytes),
    approach: summary.approach as VerifiedSummary['approach'],
    experiment: text(summary.experiment),
    workload: workload as unknown as VerifiedSummary['workload'],
    environment,
    metrics,
  };
}
