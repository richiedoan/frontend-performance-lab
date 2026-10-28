// @vitest-environment node
import { afterEach, expect, it } from 'vitest';
import { realpath, mkdtemp, rm, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectionFixture } from './importer.fixture';
import {
  catalogPath,
  importPlan,
  mergeRuns,
  validateCollection,
} from './importer';
import { getExperimentRegistry } from '../../src/experiments/data/catalog/registry';
import { record, writeSafe } from '../publication/files';
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
async function setup(files: Record<string, unknown>) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'import-test-'));
  roots.push(root);
  for (const [path, value] of Object.entries(files))
    await writeSafe(root, path, JSON.stringify(value));
  return root;
}
it('imports raw medians into the real registry and preserves existing runs; dry-run leaves UI untouched', async () => {
  const { files, identity } = collectionFixture();
  const root = await setup(files);
  await writeSafe(root, catalogPath, '[]');
  const plan = await validateCollection(root, identity);
  await importPlan(root, plan, true);
  expect(await readFile(join(root, catalogPath), 'utf8')).toBe('[]');
  await expect(
    readFile(join(root, 'public', plan.run.artifacts[0].path)),
  ).rejects.toThrow();
  const runs = await importPlan(root, plan, false);
  const registry = getExperimentRegistry(runs);
  const published = registry.find(
    (entry) => entry.definition.id === 'large-list',
  )!.runs;
  expect(published).toHaveLength(2);
  expect(
    published[1].results
      .filter((entry) => entry.metricId === 'journey-duration')
      .map((entry) => entry.result),
  ).toEqual([
    expect.objectContaining({
      value: 300,
      unit: 'ms',
      sampleCount: 5,
      extraction: expect.stringContaining('automation-inclusive'),
    }),
    expect.objectContaining({ value: 150, unit: 'ms', sampleCount: 5 }),
  ]);
  expect(await importPlan(root, plan, false)).toEqual(runs);
  const prior = { ...plan.run, id: 'prior-collection' };
  expect(mergeRuns([prior], runs)).toEqual([prior, plan.run]);
  expect(() => mergeRuns(runs, [{ ...plan.run, reason: 'conflict' }])).toThrow(
    'identity conflict',
  );
});
it.each([
  [
    'duplicated timestamps',
    'baseline-2.json',
    (v: Record<string, unknown>) => {
      v.startedAt = '2026-09-14T00:00:00.000Z';
    },
  ],
  [
    'environment date',
    'environment/environment.json',
    (v: Record<string, unknown>) => {
      delete v.recordedAt;
    },
  ],
  [
    'commit',
    'manifest.json',
    (v: Record<string, unknown>) => {
      record(v.provenance).sourceRevision = 'd'.repeat(40);
    },
  ],
  [
    'pipeline',
    'manifest.json',
    (v: Record<string, unknown>) => {
      record(v.provenance).pipelineId = '99';
    },
  ],
  [
    'job',
    'manifest.json',
    (v: Record<string, unknown>) => {
      record(v.provenance).jobId = '99';
    },
  ],
  [
    'profile',
    'manifest.json',
    (v: Record<string, unknown>) => {
      record(v.profile).cpuRate = 1;
    },
  ],
  [
    'missing iteration',
    'summary.json',
    (v: Record<string, unknown>) => {
      (v.rawInputs as string[]).pop();
    },
  ],
  [
    'duplicate iteration',
    'baseline-2.json',
    (v: Record<string, unknown>) => {
      v.iteration = 1;
    },
  ],
  [
    'unsafe path',
    'summary.json',
    (v: Record<string, unknown>) => {
      (v.rawInputs as string[])[0] = '../../secret';
    },
  ],
  [
    'unit',
    'baseline-1.json',
    (v: Record<string, unknown>) => {
      v.unit = 's';
    },
  ],
  [
    'negative',
    'baseline-1.json',
    (v: Record<string, unknown>) => {
      v.value = -1;
    },
  ],
  [
    'null',
    'baseline-1.json',
    (v: Record<string, unknown>) => {
      v.value = null;
    },
  ],
  [
    'summary mismatch',
    'summary.json',
    (v: Record<string, unknown>) => {
      record(record(v.routes).baseline).value = 1;
    },
  ],
  [
    'dataset checksum',
    'environment/environment.json',
    (v: Record<string, unknown>) => {
      record(record(v.observed).dataset).sha256 = 'a'.repeat(64);
    },
  ],
  [
    'raw environment',
    'baseline-1.json',
    (v: Record<string, unknown>) => {
      record(record(v.observed).viewport).width = 400;
    },
  ],
  [
    'failed',
    'summary.json',
    (v: Record<string, unknown>) => {
      v.status = 'failed';
    },
  ],
  [
    'raw failed',
    'baseline-1.json',
    (v: Record<string, unknown>) => {
      v.status = 'failed';
    },
  ],
  [
    'dirty',
    'environment/environment.json',
    (v: Record<string, unknown>) => {
      record(record(v.observed).source).dirty = true;
    },
  ],
  [
    'build',
    'build.json',
    (v: Record<string, unknown>) => {
      v.mode = 'development';
    },
  ],
] as const)('rejects %s', async (_, path, mutate) => {
  const { files, identity } = collectionFixture();
  mutate(record(files[path]));
  await expect(
    validateCollection(await setup(files), identity),
  ).rejects.toThrow();
});
it('rejects missing raw and symlink components', async () => {
  const { files, identity } = collectionFixture();
  delete files['baseline-1.json'];
  const root = await setup(files);
  await expect(validateCollection(root, identity)).rejects.toThrow();
  await symlink(join(root, 'baseline-2.json'), join(root, 'baseline-1.json'));
  await expect(validateCollection(root, identity)).rejects.toThrow('symlink');
});
it.each(['true', 'false'])(
  'runs the actual Node importer CLI in dry-run mode without changing UI data (CI scope flag %s)',
  async (scopeFlag) => {
    const { execFileSync, spawnSync } = await import('node:child_process');
    const { writeFile } = await import('node:fs/promises');
    const { hash } = await import('../publication/files');
    const fixture = collectionFixture();
    const root = await setup({});
    const gitDirectory = execFileSync(
      'git',
      ['rev-parse', '--absolute-git-dir'],
      { encoding: 'utf8' },
    ).trim();
    await writeFile(join(root, '.git'), `gitdir: ${gitDirectory}\n`);
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    fixture.identity.sourceRevision = commit;
    fixture.identity.lockfileSha256 = hash('fixture-lock');
    record(fixture.files['manifest.json']).provenance = fixture.identity;
    record(fixture.files['build.json']).sourceRevision = commit;
    record(
      record(record(fixture.files['environment/environment.json']).observed)
        .source,
    ).commitSha = commit;
    for (const [path, value] of Object.entries(fixture.files))
      await writeSafe(root, path, JSON.stringify(value));
    await writeSafe(root, catalogPath, '[]');
    await writeFile(join(root, 'yarn.lock'), 'fixture-lock');
    const stdout = execFileSync(
      process.execPath,
      [
        join(process.cwd(), 'scripts/benchmark/import-cli.ts'),
        root,
        '--dry-run',
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          CI_PIPELINE_ID: '100',
          BENCHMARK_JOB_ID: '200',
          CI_JOB_TOKEN_SCOPE_ENABLED: scopeFlag,
          FF_GIT_URLS_WITHOUT_TOKENS: 'false',
          FF_MASK_ALL_DEFAULT_TOKENS: 'true',
          FF_DISABLE_AUTOMATIC_TOKEN_ROTATION: 'false',
          FF_SECRET_RESOLVING_FAILS_IF_MISSING: 'true',
        },
      },
    );
    expect(stdout).toContain('UI data unchanged');
    expect(await readFile(join(root, catalogPath), 'utf8')).toBe('[]');
    expect(
      JSON.parse(
        await readFile(join(root, 'reports/publication-import.json'), 'utf8'),
      ),
    ).toMatchObject({ status: 'validated' });
    for (const failure of [
      {
        env: { CI_PIPELINE_ID: '999' },
        phase: 'validation',
        check: 'provenance mismatch',
      },
      {
        env: { VERCEL_TOKEN: 'fixture-build' },
        phase: 'credential-scan',
        check: 'credential in publication data',
      },
    ]) {
      const child = spawnSync(
        process.execPath,
        [
          join(process.cwd(), 'scripts/benchmark/import-cli.ts'),
          root,
          '--dry-run',
        ],
        {
          cwd: root,
          encoding: 'utf8',
          env: {
            ...process.env,
            CI_PIPELINE_ID: '100',
            BENCHMARK_JOB_ID: '200',
            ...failure.env,
          },
        },
      );
      expect(child.status).toBe(1);
      expect(child.stderr).toContain(
        `phase=${failure.phase}, check=${failure.check}`,
      );
      const report = await readFile(
        join(root, 'reports/publication-import.json'),
        'utf8',
      );
      expect(JSON.parse(report)).toEqual({
        status: 'failed',
        phase: failure.phase,
        check: failure.check,
      });
      expect(report + child.stderr + child.stdout).not.toContain(
        'fixture-build',
      );
      expect(await readFile(join(root, catalogPath), 'utf8')).toBe('[]');
    }
  },
);
it('maps the existing image-font-delivery scenario to its image-font registry definition', async () => {
  const fixture = collectionFixture();
  record(fixture.files['manifest.json']).experiment = 'image-font-delivery';
  for (const [path, value] of Object.entries(fixture.files))
    if (/^(baseline|optimized)-\d\.json$/.test(path))
      record(value).scenario = 'image-font-delivery';
  const plan = await validateCollection(
    await setup(fixture.files),
    fixture.identity,
  );
  expect(plan.run.experimentId).toBe('image-font');
  expect(
    getExperimentRegistry([plan.run]).find(
      (entry) => entry.definition.id === 'image-font',
    )!.runs,
  ).toHaveLength(2);
});
