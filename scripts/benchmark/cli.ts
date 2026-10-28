import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  createEvidence,
  parseOptions,
  schedule,
  writeEvidence,
} from './runner-model.ts';
import { profile } from './environment.ts';
import { journeyReadinessPolicy } from './dataset-readiness.ts';
async function main() {
  const args = process.argv.slice(2);
  const compare = args[0] === 'compare';
  const options = parseOptions(compare ? args.slice(1) : args, compare);
  const { id, directory } = await createEvidence(
    resolve(process.env.BENCHMARK_OUTPUT_ROOT ?? 'artifacts/benchmarks'),
  );
  await writeEvidence(directory, 'manifest.json', {
    id,
    provenance: {
      sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim(),
      lockfileSha256: createHash('sha256')
        .update(await readFile('yarn.lock'))
        .digest('hex'),
      pipelineId: process.env.CI_PIPELINE_ID ?? null,
      jobId: process.env.CI_JOB_ID ?? null,
    },
    ...options,
    profile,
    collector: options.lighthouse ? 'lighthouse@13.4.1' : 'journey',
    ...(!options.lighthouse ? { readinessPolicy: journeyReadinessPolicy } : {}),
    schedule: schedule(options.routes),
    warmupPolicy: 'zero warm-up iterations (mobile-cold-v1)',
    metric: options.lighthouse
      ? 'Lighthouse navigation: LCP, CLS, TBT, Speed Index, transfer bytes, JS bootup; no field INP'
      : 'dashboard-detail-dashboard journey duration, ms, Node monotonic clock; includes automation and network waits',
    environmentPath: 'environment/environment.json',
  });
  if (process.env.CI_PIPELINE_ID) {
    await mkdir('artifacts/publication', { recursive: true });
    await writeFile(
      'artifacts/publication/index.json',
      JSON.stringify({ collectionId: id }),
      { flag: 'wx' },
    );
  }
  console.log(`Evidence: ${directory}`);
  if (options.dryRun) {
    await writeEvidence(directory, 'summary.json', {
      status: 'not-available',
      reason: 'Dry run: no build, browser, requests or measurements executed.',
      rawInputs: [],
    });
    return;
  }
  const child = spawn(
    process.execPath,
    [
      'node_modules/@playwright/test/cli.js',
      'test',
      '--config',
      'scripts/benchmark/runner.config.ts',
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        BENCHMARK_RUN_DIRECTORY: directory,
        BENCHMARK_RUN_OPTIONS: JSON.stringify(options),
      },
    },
  );
  process.exitCode = await new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
