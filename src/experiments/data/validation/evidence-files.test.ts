// @vitest-environment node
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  readFile,
  writeFile,
  rm,
  symlink,
  mkdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createEvidenceRun, validateEvidenceRun } from './evidence-files';
import { measuredFixture } from './fixtures/evidence-fixture';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'lab-evidence-test-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});
const options = () => ({ root, experimentId: 'large-list', runId: 'fixture' });
async function complete() {
  const directory = await createEvidenceRun(options());
  const manifest = JSON.parse(
    await readFile(join(directory, 'manifest.json'), 'utf8'),
  );
  manifest.status = 'complete';
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest));
  return directory;
}
async function recorded() {
  const directory = await complete();
  const data = JSON.stringify({
    samples: [10, 10, 10, 10, 10],
    note: 'Synthetic test fixture only',
  });
  await writeFile(join(directory, 'samples.json'), data);
  const run = measuredFixture(
    'fixture',
    createHash('sha256').update(data).digest('hex'),
  );
  await writeFile(join(directory, 'raw-results.json'), JSON.stringify(run));
  await writeFile(
    join(directory, 'environment.json'),
    JSON.stringify(run.environment),
  );
  return { directory, run };
}
it('creates only an unavailable draft, refuses overwrite, and validates on explicit draft inspection', async () => {
  const directory = await createEvidenceRun(options());
  await expect(validateEvidenceRun(options())).rejects.toThrow('still draft');
  expect(await validateEvidenceRun(options(), true)).toMatchObject({
    status: 'draft',
    measuredResults: 0,
    unavailableResults: 2,
  });
  const before = await readFile(join(directory, 'raw-results.json'), 'utf8');
  await expect(createEvidenceRun(options())).rejects.toThrow();
  expect(await readFile(join(directory, 'raw-results.json'), 'utf8')).toBe(
    before,
  );
});
it('accepts complete unavailable runs without presenting them as measurements', async () => {
  await complete();
  expect(await validateEvidenceRun(options())).toMatchObject({
    status: 'complete',
    measuredResults: 0,
    unavailableResults: 2,
  });
});
it('validates recorded fixture metadata and real file checksums', async () => {
  const { directory } = await recorded();
  expect(await validateEvidenceRun(options())).toMatchObject({
    measuredResults: 1,
  });
  await writeFile(join(directory, 'samples.json'), 'tampered');
  await expect(validateEvidenceRun(options())).rejects.toThrow(
    'Checksum mismatch',
  );
});
it.each([
  'prompt.md',
  'output.md',
  'diff.patch',
  'tests.txt',
  'environment.json',
  'raw-results.json',
  'human-evaluation.md',
])('requires %s', async (file) => {
  const directory = await complete();
  await rm(join(directory, file));
  await expect(validateEvidenceRun(options())).rejects.toThrow();
});
it('rejects missing optional referenced evidence, mismatched environment and malformed JSON', async () => {
  const { directory, run } = await recorded();
  await rm(join(directory, 'samples.json'));
  await expect(validateEvidenceRun(options())).rejects.toThrow();
  await writeFile(join(directory, 'environment.json'), '{}');
  await expect(validateEvidenceRun(options())).rejects.toThrow('differs');
  await writeFile(join(directory, 'raw-results.json'), '{');
  await expect(validateEvidenceRun(options())).rejects.toThrow();
  expect(run.status).toBe('recorded');
});
it.each(['../escape', '/absolute', 'a\\b', 'a%2fb', 'two words'])(
  'rejects unsafe run ID %s',
  async (runId) => {
    await expect(createEvidenceRun({ ...options(), runId })).rejects.toThrow(
      'IDs',
    );
  },
);
it('rejects unsafe/cross-run artifact paths and invalid metrics', async () => {
  const { directory, run } = await recorded();
  for (const path of [
    'evidence/../escape',
    '/tmp/escape',
    'evidence/large-list/other/raw.json',
  ]) {
    const copy = structuredClone(run);
    copy.artifacts[0].path = path;
    if (copy.results[0].result.status === 'measured')
      copy.results[0].result.evidencePath = path;
    await writeFile(join(directory, 'raw-results.json'), JSON.stringify(copy));
    await expect(validateEvidenceRun(options())).rejects.toThrow();
  }
  for (const change of [
    { unit: 'ms' },
    { aggregation: 'invalid' },
    { sampleCount: 0 },
    { evidencePath: 'evidence/missing.json' },
  ]) {
    const copy = structuredClone(run);
    Object.assign(copy.results[0].result, change);
    await writeFile(join(directory, 'raw-results.json'), JSON.stringify(copy));
    await expect(validateEvidenceRun(options())).rejects.toThrow();
  }
});
it('rejects absent metadata and empty unavailable reasons', async () => {
  const directory = await complete();
  const run = JSON.parse(
    await readFile(join(directory, 'raw-results.json'), 'utf8'),
  );
  run.results[0].result.reason = '';
  await writeFile(join(directory, 'raw-results.json'), JSON.stringify(run));
  await expect(validateEvidenceRun(options())).rejects.toThrow();
  await writeFile(join(directory, 'manifest.json'), '{}');
  await expect(validateEvidenceRun(options())).rejects.toThrow('metadata');
});
it('rejects symlinked parent directories, documents and optional files', async () => {
  const outside = join(root, 'outside');
  await mkdir(outside);
  await symlink(outside, join(root, 'evidence'));
  await expect(createEvidenceRun(options())).rejects.toThrow('Symlinks');
  await rm(join(root, 'evidence'));
  const directory = await complete();
  await symlink(outside, join(directory, 'heap'));
  await expect(validateEvidenceRun(options())).rejects.toThrow('Symlinks');
  await rm(join(directory, 'heap'));
  await rm(join(directory, 'prompt.md'));
  await symlink(join(directory, 'output.md'), join(directory, 'prompt.md'));
  await expect(validateEvidenceRun(options())).rejects.toThrow('Symlinks');
});
it('runs both CLI commands on Node 24 and reports failure through exit status', () => {
  const args = [
    '--root',
    root,
    '--experiment',
    'large-list',
    '--run',
    'cli-test',
  ];
  const cli = 'scripts/evidence.ts';
  expect(
    execFileSync(process.execPath, [cli, 'create', ...args], {
      encoding: 'utf8',
    }),
  ).toContain('Created draft');
  expect(() =>
    execFileSync(process.execPath, [cli, 'validate', ...args], {
      stdio: 'pipe',
    }),
  ).toThrow();
  expect(
    execFileSync(
      process.execPath,
      [cli, 'validate', ...args, '--allow-draft'],
      { encoding: 'utf8' },
    ),
  ).toContain('"measuredResults": 0');
});
