import { readdir, readFile, realpath, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { catalogPath, validateRuns } from '../benchmark/importer.ts';
import { equal, hash, readSafe, requireValue } from './files.ts';
import type { ExperimentRun } from '../../src/experiments/data/types/experiment.ts';
export async function verifyEvidence(root: string, runs: ExperimentRun[]) {
  for (const run of runs)
    for (const artifact of run.artifacts)
      equal(
        hash(await readSafe(root, artifact.path)),
        artifact.sha256,
        'evidence checksum',
      );
}
export async function scanSecrets(
  root: string,
  secrets: string[],
  boundary = root,
  visited = new Set<string>(),
) {
  const physical = await realpath(root);
  const allowed = await realpath(boundary);
  requireValue(
    physical === allowed || physical.startsWith(`${allowed}/`),
    'output link escapes build',
  );
  if (visited.has(physical)) return;
  visited.add(physical);
  for (const entry of await readdir(physical, { withFileTypes: true })) {
    const path = await realpath(join(physical, entry.name));
    requireValue(path.startsWith(`${allowed}/`), 'output link escapes build');
    const stat = await lstat(path);
    if (stat.isDirectory()) await scanSecrets(path, secrets, boundary, visited);
    else if (stat.isFile()) {
      const data = await readFile(path);
      requireValue(
        !secrets
          .filter(Boolean)
          .some((secret) => data.includes(Buffer.from(secret))),
        'credential in output',
      );
    }
  }
}
export async function verifyOutput(
  root: string,
  runs: ExperimentRun[],
  snapshot: unknown,
  secrets: string[],
) {
  const output = join(root, '.vercel/output');
  equal(
    JSON.parse(
      await readSafe(output, 'static/evidence/publication-snapshot.json'),
    ),
    snapshot,
    'static snapshot',
  );
  await verifyEvidence(join(output, 'static'), runs);
  // Fail closed if the provider changes this framework function layout.
  const fn = join(output, 'functions/api/case-study.func');
  equal(
    validateRuns(JSON.parse(await readSafe(fn, catalogPath))),
    runs,
    'function registry',
  );
  await verifyEvidence(join(fn, 'public'), runs);
  await scanSecrets(output, secrets);
}

/** Vercel pull stores these privately; collect secret values only for the output gate. */
export async function pulledSecrets(root: string): Promise<string[]> {
  let contents: string;
  try {
    contents = await readSafe(root, '.vercel/.env.production.local');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const values: string[] = [];
  for (const line of contents.split('\n')) {
    const match = /^(?:export\s+)?([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match || !/TOKEN|SECRET|PASSWORD|PRIVATE_KEY/.test(match[1])) continue;
    requireValue(
      !match[1].startsWith('NEXT_PUBLIC_'),
      'public credential variable',
    );
    const raw = match[2].trim();
    let value = raw;
    if (raw.startsWith('"')) {
      try {
        value = JSON.parse(raw);
      } catch {
        throw new Error('Publication validation: secret environment syntax');
      }
    } else if (raw.startsWith("'")) {
      requireValue(raw.endsWith("'"), 'secret environment syntax');
      value = raw.slice(1, -1);
    }
    requireValue(typeof value === 'string', 'secret environment syntax');
    if (value) values.push(value);
  }
  return values;
}
