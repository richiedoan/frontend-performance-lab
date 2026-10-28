import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { importPlan, validateCollection } from './importer.ts';
import {
  assertNoSecrets,
  credentialValues,
  failureCheck,
  hash,
  jsonFile,
  record,
  requireValue,
  replaceJson,
} from '../publication/files.ts';
let phase = 'arguments';
const secrets = credentialValues(process.env);
try {
  const [directory, ...flags] = process.argv.slice(2);
  requireValue(
    directory &&
      (flags.length === 0 || (flags.length === 1 && flags[0] === '--dry-run')),
    'usage: import-cli.ts directory [--dry-run]',
  );
  phase = 'manifest';
  const provenance = record(
    record(await jsonFile(resolve(directory), 'manifest.json')).provenance,
  );
  phase = 'checkout';
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  phase = 'lockfile';
  const lockfileSha256 = hash(await readFile('yarn.lock'));
  phase = 'validation';
  const plan = await validateCollection(resolve(directory), {
    sourceRevision,
    lockfileSha256,
    pipelineId: process.env.CI_PIPELINE_ID ?? String(provenance.pipelineId),
    jobId: process.env.BENCHMARK_JOB_ID ?? String(provenance.jobId),
  });
  phase = 'credential-scan';
  assertNoSecrets(JSON.stringify(plan), secrets);
  phase = 'import';
  await importPlan(process.cwd(), plan, flags[0] === '--dry-run');
  console.log(
    flags[0] === '--dry-run'
      ? 'Artifact validated; UI data unchanged.'
      : 'Artifact imported; production build can now read it.',
  );
} catch (error) {
  const check = failureCheck(error, secrets);
  try {
    await replaceJson(process.cwd(), 'reports/publication-import.json', {
      status: 'failed',
      phase,
      check,
    });
  } catch {
    console.error('Could not write publication import report.');
  }
  console.error(
    `Artifact validation/import failed: phase=${phase}, check=${check}; no deployment attempted.`,
  );
  process.exitCode = 1;
}
