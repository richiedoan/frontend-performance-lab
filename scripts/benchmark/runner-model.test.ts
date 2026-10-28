// @vitest-environment node
import { it, expect } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createEvidence,
  median,
  parseOptions,
  schedule,
  summarize,
  writeEvidence,
  type Iteration,
} from './runner-model';
it('computes median without selecting best, mutating inputs or removing outliers', () => {
  const samples = [1000, 2, 3, 1, 4];
  expect(median(samples)).toBe(3);
  expect(samples).toEqual([1000, 2, 3, 1, 4]);
  expect(median([4, 1, 2, 3])).toBe(2.5);
  expect(() => median([])).toThrow();
  expect(() => median([NaN])).toThrow();
});
it('schedules exactly five per route, alternates pairs and validates CLI', () => {
  expect(schedule(['baseline', 'optimized']).map((x) => x.route)).toEqual([
    'baseline',
    'optimized',
    'optimized',
    'baseline',
    'baseline',
    'optimized',
    'optimized',
    'baseline',
    'baseline',
    'optimized',
  ]);
  expect(parseOptions(['large-list', '--route=baseline', '--dry-run'])).toEqual(
    { experiment: 'large-list', routes: ['baseline'], dryRun: true },
  );
  expect(parseOptions(['large-list'], true).routes).toEqual([
    'baseline',
    'optimized',
  ]);
  for (const args of [
    ['unknown'],
    ['large-list'],
    ['large-list', '--route=other'],
    ['large-list', '--route=baseline', '--route=optimized'],
    ['large-list', '--route=baseline', '--dry-run', '--dry-run'],
  ])
    expect(() => parseOptions(args)).toThrow();
});
it('retains failed iterations and refuses a median of only surviving results', () => {
  const samples: Iteration[] = Array.from({ length: 5 }, (_, i) => ({
    route: 'baseline',
    iteration: i + 1,
    evidencePath: `baseline-${i + 1}.json`,
    status: 'passed',
    value: i,
  }));
  expect(summarize(samples, 'baseline')).toMatchObject({
    status: 'measured',
    value: 2,
    sampleCount: 5,
  });
  samples[2] = {
    route: 'baseline',
    iteration: 3,
    evidencePath: 'baseline-3.json',
    status: 'failed',
    reason: 'Fixture failure',
  };
  expect(summarize(samples, 'baseline')).toMatchObject({
    status: 'not-available',
    sampleCount: 4,
    evidencePaths: samples.map((x) => x.evidencePath),
  });
  expect(summarize([], 'optimized').status).toBe('not-available');
});
it('generates unique evidence directories and links summary to preserved raw inputs without overwrite', async () => {
  const root = await mkdtemp(join(tmpdir(), 'benchmark-fixture-'));
  try {
    const runs = await Promise.all(
      Array.from({ length: 20 }, () => createEvidence(root)),
    );
    expect(new Set(runs.map((run) => run.id)).size).toBe(20);
    const dir = runs[0].directory;
    const raw: Iteration = {
      route: 'baseline',
      iteration: 1,
      evidencePath: 'baseline-1.json',
      status: 'failed',
      reason: 'Fixture only',
    };
    await writeEvidence(dir, raw.evidencePath, raw);
    await writeEvidence(dir, 'summary.json', summarize([raw], 'baseline'));
    const summary = JSON.parse(
      await readFile(join(dir, 'summary.json'), 'utf8'),
    );
    expect(
      JSON.parse(await readFile(join(dir, summary.evidencePaths[0]), 'utf8')),
    ).toEqual(raw);
    await expect(writeEvidence(dir, raw.evidencePath, {})).rejects.toThrow();
    await expect(writeEvidence(dir, '../unsafe.json', {})).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
