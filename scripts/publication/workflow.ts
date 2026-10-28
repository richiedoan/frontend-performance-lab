import { realpath, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  catalogPath,
  importPlan,
  mergeRuns,
  validateCollection,
  validateRuns,
  type Identity,
} from '../benchmark/importer.ts';
import {
  assertNoSecrets,
  credentialValues,
  equal,
  failureCheck,
  hash,
  jsonFile,
  record,
  replaceJson,
  requireValue,
  safePath,
  writeSafe,
} from './files.ts';
import { download, GitLab, httpsUrl, type Fetch } from './gitlab.ts';
import { ProviderCommandError } from './provider-error.ts';
import {
  pulledSecrets,
  verifyEvidence,
  verifyOutput,
} from './verify-output.ts';
export interface Boundary {
  fetcher?: Fetch;
  command: (args: string[]) => Promise<string>;
  verify?: typeof verifyOutput;
}
export async function publish(
  root: string,
  env: NodeJS.ProcessEnv,
  boundary: Boundary,
  dryRun = false,
) {
  const report: Record<string, unknown> = {
    status: 'not-deployed',
    phase: 'gates',
  };
  const secrets = credentialValues(env);
  let directory: string | undefined;
  try {
    if (env.PUBLICATION_DRY_RUN === 'true' && !dryRun)
      return Object.assign(report, { reason: 'dry-run-only' });
    if (
      env.PUBLICATION_ENABLED !== 'true' &&
      !(dryRun && env.PUBLICATION_DRY_RUN === 'true')
    )
      return Object.assign(report, { reason: 'disabled' });
    requireValue(
      env.CI === 'true' &&
        env.CI_COMMIT_REF_PROTECTED === 'true' &&
        env.CI_COMMIT_BRANCH &&
        env.CI_COMMIT_BRANCH === env.CI_DEFAULT_BRANCH &&
        env.CI_PIPELINE_SOURCE !== 'merge_request_event' &&
        env.CI_ENVIRONMENT_NAME === 'production',
      'publication gates',
    );
    const required = (name: string) => {
      requireValue(env[name], `missing ${name}`);
      return env[name]!;
    };
    const commit = required('CI_COMMIT_SHA');
    const pipeline = required('CI_PIPELINE_ID');
    const gitlab = new GitLab(
      required('CI_API_V4_URL'),
      required('CI_PROJECT_ID'),
      pipeline,
      commit,
      required('GITLAB_PUBLICATION_READ_TOKEN'),
      boundary.fetcher,
    );
    report.phase = 'download';
    const job = await gitlab.selectedJob();
    if (!job || job.status !== 'success')
      return Object.assign(report, {
        reason: job ? `benchmark-${job.status}` : 'benchmark-absent',
      });
    const indexText = await gitlab.artifact(
      job.id,
      'artifacts/publication/index.json',
    );
    if (!indexText)
      return Object.assign(report, { reason: 'benchmark-artifacts-absent' });
    const index = record(JSON.parse(indexText));
    requireValue(
      typeof index.collectionId === 'string' &&
        /^[a-zA-Z0-9-]+$/.test(index.collectionId),
      'collection index',
    );
    directory = await mkdtemp(join(await realpath(tmpdir()), 'publication-'));
    const paths = [
      'manifest.json',
      'summary.json',
      'build.json',
      'environment/environment.json',
      ...['baseline', 'optimized'].flatMap((route) =>
        Array.from({ length: 5 }, (_, i) => `${route}-${i + 1}.json`),
      ),
    ];
    for (const path of paths) {
      const body = await gitlab.artifact(
        job.id,
        `artifacts/benchmarks/${index.collectionId}/${path}`,
      );
      requireValue(body, 'referenced artifact missing');
      await writeSafe(directory, path, body);
    }
    const identity: Identity = {
      sourceRevision: commit,
      pipelineId: pipeline,
      jobId: String(job.id),
      lockfileSha256: hash(await readFile(join(root, 'yarn.lock'))),
    };
    equal(
      (await boundary.command(['git-head'])).trim(),
      commit,
      'checkout commit',
    );
    report.phase = 'validation';
    const plan = await validateCollection(directory, identity);
    assertNoSecrets(JSON.stringify(plan), secrets);
    report.runId = plan.run.id;
    equal(
      record(await jsonFile(directory, 'manifest.json')).id,
      index.collectionId,
      'index identity',
    );
    await gitlab.fresh(env.CI_COMMIT_BRANCH);
    if (dryRun) {
      await importPlan(root, plan, true);
      return Object.assign(report, { status: 'validated', runId: plan.run.id });
    }
    required('VERCEL_TOKEN');
    report.phase = 'history';
    required('VERCEL_ORG_ID');
    required('VERCEL_PROJECT_ID');
    report.phase = 'pull';
    await boundary.command(['pull', '--yes', '--environment=production']);
    report.phase = 'pull-secrets';
    secrets.push(...(await pulledSecrets(root)));
    assertNoSecrets(JSON.stringify(plan), secrets);
    report.phase = 'history';
    const origin = httpsUrl(required('PUBLICATION_PRODUCTION_URL'));
    requireValue(
      origin.pathname === '/' && !origin.search,
      'production origin',
    );
    const oldText = await download(
      `${origin.origin}/evidence/publication-snapshot.json`,
      undefined,
      boundary.fetcher,
      false,
    );
    let historical = validateRuns([]);
    if (oldText === null)
      requireValue(
        env.PUBLICATION_INITIAL_DEPLOYMENT === 'true',
        'production snapshot missing',
      );
    else {
      assertNoSecrets(oldText, secrets);
      const old = record(JSON.parse(oldText));
      equal(old.schemaVersion, 1, 'snapshot schema');
      equal(old.projectId, env.CI_PROJECT_ID, 'snapshot project');
      requireValue(
        typeof old.pipelineId === 'string' &&
          /^\d+$/.test(old.pipelineId) &&
          BigInt(old.pipelineId) < BigInt(pipeline),
        'snapshot monotonicity',
      );
      historical = validateRuns(old.runs);
      for (const run of historical)
        for (const artifact of run.artifacts) {
          safePath(artifact.path);
          const body = await download(
            `${origin.origin}/${artifact.path}`,
            undefined,
            boundary.fetcher,
            false,
          );
          requireValue(body !== null, 'historical evidence missing');
          equal(hash(body), artifact.sha256, 'historical evidence hash');
          assertNoSecrets(body, secrets);
          await writeSafe(join(root, 'public'), artifact.path, body);
        }
    }
    const current = validateRuns(await jsonFile(root, catalogPath));
    await verifyEvidence(join(root, 'public'), mergeRuns(current, historical));
    assertNoSecrets(JSON.stringify(current), secrets);
    await gitlab.fresh(env.CI_COMMIT_BRANCH);
    report.phase = 'import';
    const runs = await importPlan(root, plan, false, historical);
    const snapshot = {
      schemaVersion: 1,
      projectId: env.CI_PROJECT_ID,
      pipelineId: pipeline,
      sourceRevision: commit,
      runs,
    };
    await replaceJson(
      root,
      'public/evidence/publication-snapshot.json',
      snapshot,
    );
    await replaceJson(root, 'reports/publication-snapshot.json', snapshot);
    report.phase = 'build';
    await boundary.command(['build', '--prod']);
    report.phase = 'verify-output';
    await (boundary.verify ?? verifyOutput)(root, runs, snapshot, secrets);
    await gitlab.fresh(env.CI_COMMIT_BRANCH);
    report.phase = 'stage';
    const staged = (
      await boundary.command([
        'deploy',
        '--prebuilt',
        '--prod',
        '--skip-domain',
        '--meta',
        `sourceCommit=${commit}`,
        '--meta',
        `collectionId=${index.collectionId}`,
        '--meta',
        `pipelineId=${pipeline}`,
      ])
    ).trim();
    assertNoSecrets(staged, secrets);
    const url = httpsUrl(staged);
    requireValue(
      url.hostname.endsWith('.vercel.app') &&
        url.pathname === '/' &&
        !url.search,
      'deployment URL',
    );
    report.stagedUrl = url.origin;
    await gitlab.fresh(env.CI_COMMIT_BRANCH);
    report.phase = 'promote';
    await boundary.command(['promote', url.origin, '--yes']);
    report.status = 'deployed';
    report.runId = plan.run.id;
    return report;
  } catch (error) {
    report.check = failureCheck(error, secrets);
    if (error instanceof ProviderCommandError) {
      report.exitCode = error.exitCode;
      report.signal = error.signal;
    }
    // Boundary exceptions may contain signed URLs, headers or child-process output.
    report.status = 'failed';
    throw new Error(
      'Publication failed; validation, build or provider boundary rejected. Deployment was not promoted by subsequent steps.',
    );
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true });
    await replaceJson(root, 'reports/publication.json', report);
  }
}
