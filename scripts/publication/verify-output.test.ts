// @vitest-environment node
import { afterEach, expect, it } from 'vitest';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectionFixture } from '../benchmark/importer.fixture';
import { catalogPath, validateCollection } from '../benchmark/importer';
import { writeSafe } from './files';
import { verifyOutput } from './verify-output';
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
async function setup() {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'output-test-'));
  roots.push(root);
  const fixture = collectionFixture();
  for (const [path, value] of Object.entries(fixture.files))
    await writeSafe(root, path, JSON.stringify(value));
  const plan = await validateCollection(root, fixture.identity);
  const runs = [plan.run];
  const snapshot = { runs };
  const output = join(root, '.vercel/output');
  const fn = join(output, 'functions/api/case-study.func');
  await writeSafe(
    output,
    'static/evidence/publication-snapshot.json',
    JSON.stringify(snapshot),
  );
  await writeSafe(
    output,
    `static/${plan.run.artifacts[0].path}`,
    plan.evidence,
  );
  await writeSafe(fn, catalogPath, JSON.stringify(runs));
  await writeSafe(fn, `public/${plan.run.artifacts[0].path}`, plan.evidence);
  return { root, runs, snapshot, output, fn, plan };
}
it('verifies static snapshot, static evidence and the Case Study function inputs', async () => {
  const s = await setup();
  await expect(
    verifyOutput(s.root, s.runs, s.snapshot, ['secret-fixture']),
  ).resolves.toBeUndefined();
});
it.each([
  'static evidence',
  'function registry',
  'function evidence',
  'snapshot',
  'credential',
] as const)('rejects invalid %s before deploy', async (failure) => {
  const s = await setup();
  if (failure === 'static evidence')
    await writeFile(
      join(s.output, 'static', s.plan.run.artifacts[0].path),
      '{}',
    );
  if (failure === 'function registry')
    await writeFile(join(s.fn, catalogPath), '[]');
  if (failure === 'function evidence')
    await rm(join(s.fn, 'public', s.plan.run.artifacts[0].path));
  if (failure === 'snapshot')
    await writeFile(
      join(s.output, 'static/evidence/publication-snapshot.json'),
      '{}',
    );
  if (failure === 'credential')
    await writeSafe(s.output, 'static/assets/main.js', 'secret-fixture');
  await expect(
    verifyOutput(s.root, s.runs, s.snapshot, ['secret-fixture']),
  ).rejects.toThrow();
});
it('rejects escaping output links and scans credentials in pulled private settings', async () => {
  const { symlink } = await import('node:fs/promises');
  const { pulledSecrets } = await import('./verify-output');
  const s = await setup();
  await writeSafe(
    s.root,
    '.vercel/.env.production.local',
    'API_SECRET="provider-secret"\nNEXT_PUBLIC_COLOR="blue"\n',
  );
  expect(await pulledSecrets(s.root)).toEqual(['provider-secret']);
  await writeSafe(s.root, 'outside.js', 'provider-secret');
  await symlink(join(s.root, 'outside.js'), join(s.output, 'static/linked.js'));
  await expect(
    verifyOutput(s.root, s.runs, s.snapshot, ['provider-secret']),
  ).rejects.toThrow('output link escapes');
  await writeFile(
    join(s.root, '.vercel/.env.production.local'),
    'NEXT_PUBLIC_TOKEN="secret"',
  );
  await expect(pulledSecrets(s.root)).rejects.toThrow('public credential');
});
