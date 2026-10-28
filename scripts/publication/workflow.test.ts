import { requiredCheckJobs } from '../ci/required-jobs';
// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { realpath, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectionFixture } from '../benchmark/importer.fixture';
import { catalogPath } from '../benchmark/importer';
import { record, writeSafe } from './files';
import { publish } from './workflow';
import { providerFailure } from './provider-error';
import { download, GitLab } from './gitlab';
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
async function setup() {
  const fixture = collectionFixture();
  const root = await mkdtemp(
    join(await realpath(tmpdir()), 'publication-test-'),
  );
  roots.push(root);
  await writeSafe(root, catalogPath, '[]');
  await writeSafe(root, 'yarn.lock', 'fixture-lock');
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: 'test',
    CI: 'true',
    PUBLICATION_ENABLED: 'true',
    CI_COMMIT_REF_PROTECTED: 'true',
    CI_COMMIT_BRANCH: 'main',
    CI_DEFAULT_BRANCH: 'main',
    CI_PIPELINE_SOURCE: 'schedule',
    CI_ENVIRONMENT_NAME: 'production',
    CI_COMMIT_SHA: fixture.identity.sourceRevision,
    CI_PIPELINE_ID: '100',
    CI_PROJECT_ID: '123',
    CI_API_V4_URL: 'https://gitlab.example/api/v4',
    GITLAB_PUBLICATION_READ_TOKEN: 'gitlab-secret-fixture',
    VERCEL_TOKEN: 'vercel-secret-fixture',
    VERCEL_ORG_ID: 'team',
    VERCEL_PROJECT_ID: 'project',
    PUBLICATION_PRODUCTION_URL: 'https://production.example',
    PUBLICATION_INITIAL_DEPLOYMENT: 'true',
  };
  const job = (id: number, name: string, status: string) => ({
    id,
    name,
    status,
    commit: { id: fixture.identity.sourceRevision },
    pipeline: { id: 100, sha: fixture.identity.sourceRevision },
  });
  const jobs = [
    job(200, 'benchmark-journey', 'success'),
    ...requiredCheckJobs.map((name, index) =>
      job(150 + index, name, 'success'),
    ),
    job(300, 'benchmark-memory', 'running'),
    job(301, 'benchmark-lighthouse', 'failed'),
    job(302, 'benchmark-bundle', 'manual'),
    job(303, 'benchmark', 'success'),
  ];
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(String(input));
    if (url.hostname === 'production.example')
      return new Response(null, { status: 404 });
    if (url.pathname.endsWith('/jobs')) return Response.json(jobs);
    if (url.pathname.endsWith('/repository/branches/main'))
      return Response.json({ commit: { id: fixture.identity.sourceRevision } });
    if (url.pathname.endsWith('/pipelines'))
      return Response.json([{ id: 100 }]);
    if (url.pathname.endsWith('/artifacts/publication/index.json'))
      return Response.json({ collectionId: 'synthetic-collection' });
    const prefix =
      '/jobs/200/artifacts/artifacts/benchmarks/synthetic-collection/';
    const path = url.pathname.split(prefix)[1];
    if (path && fixture.files[path]) return Response.json(fixture.files[path]);
    throw new Error('Unexpected mock request');
  });
  const command = vi.fn(async (args: string[]) =>
    args[0] === 'git-head'
      ? fixture.identity.sourceRevision
      : args[0] === 'deploy'
        ? 'https://staged.vercel.app'
        : '',
  );
  const verify = vi.fn(async () => {});
  return { root, fixture, env, jobs, fetcher, command, verify };
}
it('fetches exact pipeline benchmark job and imports before build, verifies before staging then promotes without waiting for other measurement jobs', async () => {
  const s = await setup();
  s.command.mockImplementation(async (args) => {
    if (args[0] === 'git-head') return s.fixture.identity.sourceRevision;
    if (args[0] === 'build')
      expect(
        JSON.parse(await readFile(join(s.root, catalogPath), 'utf8')),
      ).toHaveLength(1);
    if (args[0] === 'deploy') {
      expect(s.verify).toHaveBeenCalledOnce();
      return 'https://staged.vercel.app';
    }
    return '';
  });
  expect(await publish(s.root, s.env, s)).toMatchObject({ status: 'deployed' });
  expect(s.command.mock.calls.map(([args]) => args[0])).toEqual([
    'git-head',
    'pull',
    'build',
    'deploy',
    'promote',
  ]);
  const urls = s.fetcher.mock.calls.map(([url]) => String(url));
  expect(
    urls.some((url) =>
      url.includes('/pipelines/100/jobs?include_retried=true'),
    ),
  ).toBe(true);
  expect(
    urls
      .filter((url) => url.includes('/artifacts/'))
      .every((url) => url.includes('/jobs/200/artifacts/')),
  ).toBe(true);
  expect(
    urls.some((url) => url.includes('latest') || url.includes('/jobs/300/')),
  ).toBe(false);
});
it.each(['validation', 'build', 'output', 'freshness'] as const)(
  'never promotes when %s fails and suppresses boundary credentials',
  async (failure) => {
    const s = await setup();
    if (failure === 'validation')
      record(s.fixture.files['summary.json']).status = 'failed';
    if (failure === 'build')
      s.command.mockImplementation(async (args) => {
        if (args[0] === 'git-head') return s.fixture.identity.sourceRevision;
        if (args[0] === 'build')
          throw new Error(`provider leaked ${s.env.VERCEL_TOKEN}`);
        return '';
      });
    if (failure === 'output')
      s.verify.mockRejectedValue(
        new Error(`leaked ${s.env.GITLAB_PUBLICATION_READ_TOKEN}`),
      );
    if (failure === 'freshness') {
      const original = s.fetcher.getMockImplementation()!;
      let checks = 0;
      s.fetcher.mockImplementation(async (...args) => {
        if (String(args[0]).includes('/pipelines?') && ++checks === 4)
          return Response.json([{ id: 101 }]);
        return original(...args);
      });
    }
    await expect(publish(s.root, s.env, s)).rejects.toThrow(
      'Publication failed',
    );
    expect(s.command.mock.calls.some(([args]) => args[0] === 'promote')).toBe(
      false,
    );
    if (failure !== 'freshness')
      expect(s.command.mock.calls.some(([args]) => args[0] === 'deploy')).toBe(
        false,
      );
    const report = await readFile(
      join(s.root, 'reports/publication.json'),
      'utf8',
    );
    expect(report).not.toContain('secret-fixture');
    expect(JSON.parse(report).status).toBe('failed');
  },
);
it('publication dry-run validates without writing UI or invoking provider commands', async () => {
  const s = await setup();
  delete s.env.VERCEL_TOKEN;
  expect(await publish(s.root, s.env, s, true)).toMatchObject({
    status: 'validated',
  });
  expect(await readFile(join(s.root, catalogPath), 'utf8')).toBe('[]');
  expect(s.command.mock.calls.map(([args]) => args[0])).toEqual(['git-head']);
  expect(
    s.fetcher.mock.calls.every(
      ([url]) => !String(url).includes('production.example'),
    ),
  ).toBe(true);
});
it.each(['failed', 'manual', 'running', 'canceled', 'skipped'])(
  'newest %s benchmark never falls back to successful retry',
  async (status) => {
    const s = await setup();
    s.jobs.push({ ...s.jobs[0], id: 201, status });
    expect(await publish(s.root, s.env, s)).toMatchObject({
      reason: `benchmark-${status}`,
    });
    expect(s.command).not.toHaveBeenCalled();
  },
);
it('gates and a failed newest required check prevent deploy', async () => {
  const s = await setup();
  expect(
    await publish(s.root, { ...s.env, PUBLICATION_ENABLED: 'false' }, s),
  ).toMatchObject({ reason: 'disabled' });
  expect(s.fetcher).not.toHaveBeenCalled();
  await expect(
    publish(s.root, { ...s.env, CI_COMMIT_BRANCH: 'other' }, s),
  ).rejects.toThrow();
  s.jobs.push({ ...s.jobs[1], id: 400, status: 'failed' });
  await expect(publish(s.root, s.env, s)).rejects.toThrow();
  expect(s.command).not.toHaveBeenCalled();
});
it('rejects job from another pipeline and paginates attempts', async () => {
  const s = await setup();
  s.jobs[0].pipeline.id = 99;
  await expect(publish(s.root, s.env, s)).rejects.toThrow();
  const first = Array.from({ length: 100 }, (_, i) => ({
    ...s.jobs[1],
    id: i + 1,
    name: 'unrelated',
  }));
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(first))
    .mockResolvedValueOnce(Response.json([s.jobs[1]]));
  const gitlab = new GitLab(
    s.env.CI_API_V4_URL!,
    '123',
    '100',
    s.fixture.identity.sourceRevision,
    'secret',
    fetcher,
  );
  expect(await gitlab.jobs()).toHaveLength(101);
  expect(String(fetcher.mock.calls[1][0])).toContain('page=2');
});
it('strips tokens on artifact redirects and rejects traversal, credential URLs and insecure redirects', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: 'https://storage.example/file?signature=private' },
      }),
    )
    .mockResolvedValueOnce(new Response('{}'));
  expect(await download('https://gitlab.example/file', 'secret', fetcher)).toBe(
    '{}',
  );
  expect(fetcher.mock.calls[0][1]?.headers).toEqual({
    'PRIVATE-TOKEN': 'secret',
  });
  expect(fetcher.mock.calls[1][1]?.headers).toEqual({});
  await expect(
    download('https://user:secret@gitlab.example', 'secret', fetcher),
  ).rejects.toThrow();
  fetcher.mockResolvedValueOnce(
    new Response(null, {
      status: 302,
      headers: { location: 'http://storage.example' },
    }),
  );
  await expect(
    download('https://gitlab.example/file', 'secret', fetcher),
  ).rejects.toThrow();
  const gitlab = new GitLab(
    'https://gitlab.example',
    '123',
    '100',
    'c'.repeat(40),
    'secret',
    fetcher,
  );
  for (const path of [
    '../secret',
    '/absolute',
    'a/../../secret',
    'a\\secret',
    'a/%2e%2e/secret',
  ])
    await expect(gitlab.artifact(200, path)).rejects.toThrow('unsafe path');
});
it.each(['valid', 'missing', 'corrupt', 'same pipeline'] as const)(
  'restores historical snapshot: %s',
  async (mode) => {
    const s = await setup();
    await publish(s.root, s.env, s);
    const snapshot = JSON.parse(
      await readFile(
        join(s.root, 'public/evidence/publication-snapshot.json'),
        'utf8',
      ),
    );
    snapshot.pipelineId = mode === 'same pipeline' ? '100' : '99';
    snapshot.runs[0].id = 'earlier-collection';
    const evidence = await readFile(
      join(s.root, 'public', snapshot.runs[0].artifacts[0].path),
      'utf8',
    );
    // Model a fresh CI checkout with no generated data from the previous deployment.
    await rm(join(s.root, 'public'), { recursive: true });
    await (
      await import('node:fs/promises')
    ).writeFile(join(s.root, catalogPath), '[]');
    s.command.mockClear();
    s.verify.mockClear();
    const original = s.fetcher.getMockImplementation()!;
    s.fetcher.mockImplementation(async (...args) => {
      if (String(args[0]).startsWith('https://production.example/')) {
        if (String(args[0]).endsWith('publication-snapshot.json'))
          return Response.json(snapshot);
        if (mode === 'missing') return new Response(null, { status: 404 });
        return new Response(mode === 'corrupt' ? '{}' : evidence);
      }
      return original(...args);
    });
    if (mode === 'valid') {
      await expect(publish(s.root, s.env, s)).resolves.toMatchObject({
        status: 'deployed',
      });
      const runs = JSON.parse(
        await readFile(join(s.root, catalogPath), 'utf8'),
      );
      expect(runs.map((run: { id: string }) => run.id)).toContain(
        'earlier-collection',
      );
      expect(runs).toHaveLength(2);
    } else {
      await expect(publish(s.root, s.env, s)).rejects.toThrow();
      expect(s.command.mock.calls.some(([args]) => args[0] === 'deploy')).toBe(
        false,
      );
    }
  },
);
it('does not persist known credentials from otherwise valid metadata', async () => {
  const s = await setup();
  record(record(s.fixture.files['environment/environment.json']).observed).os =
    {
      platform: 'fixture',
      release: 'fixture',
      arch: 'fixture',
      cpu: s.env.VERCEL_TOKEN,
      totalMemory: 1024,
    };
  await expect(publish(s.root, s.env, s)).rejects.toThrow();
  expect(await readFile(join(s.root, catalogPath), 'utf8')).toBe('[]');
  await expect(
    readFile(join(s.root, 'public/evidence/publication-snapshot.json')),
  ).rejects.toThrow();
});
it('allows explicit CI dry-run with publication disabled and no Vercel credentials', async () => {
  const s = await setup();
  delete s.env.PUBLICATION_ENABLED;
  s.env.PUBLICATION_DRY_RUN = 'true';
  s.env.CI_JOB_TOKEN_SCOPE_ENABLED = 'false';
  s.env.FF_GIT_URLS_WITHOUT_TOKENS = 'false';
  s.env.FF_MASK_ALL_DEFAULT_TOKENS = 'true';
  s.env.FF_DISABLE_AUTOMATIC_TOKEN_ROTATION = 'false';
  s.env.FF_SECRET_RESOLVING_FAILS_IF_MISSING = 'true';
  delete s.env.VERCEL_TOKEN;
  delete s.env.VERCEL_ORG_ID;
  delete s.env.VERCEL_PROJECT_ID;
  expect(await publish(s.root, s.env, s, true)).toMatchObject({
    status: 'validated',
  });
  expect(await readFile(join(s.root, catalogPath), 'utf8')).toBe('[]');
  expect(s.command.mock.calls.map(([args]) => args[0])).toEqual(['git-head']);
  expect(
    s.fetcher.mock.calls.every(
      ([url]) => !String(url).includes('production.example'),
    ),
  ).toBe(true);
});
it('dry-run opt-in alone cannot authorize deploy, even when both flags are enabled', async () => {
  const s = await setup();
  s.env.PUBLICATION_DRY_RUN = 'true';
  expect(await publish(s.root, s.env, s)).toMatchObject({
    reason: 'dry-run-only',
  });
  expect(s.fetcher).not.toHaveBeenCalled();
  expect(s.command).not.toHaveBeenCalled();
  delete s.env.PUBLICATION_DRY_RUN;
  delete s.env.PUBLICATION_ENABLED;
  expect(await publish(s.root, s.env, s, true)).toMatchObject({
    reason: 'disabled',
  });
  expect(s.fetcher).not.toHaveBeenCalled();
});
it.each([
  { CI_COMMIT_REF_PROTECTED: 'false' },
  { CI_COMMIT_BRANCH: 'feature' },
  { CI_PIPELINE_SOURCE: 'merge_request_event' },
  { CI_ENVIRONMENT_NAME: 'preview' },
])(
  'CI dry-run retains protected branch and environment gates: %j',
  async (override) => {
    const s = await setup();
    await expect(
      publish(
        s.root,
        {
          ...s.env,
          ...override,
          PUBLICATION_ENABLED: 'false',
          PUBLICATION_DRY_RUN: 'true',
        },
        s,
        true,
      ),
    ).rejects.toThrow();
    expect(s.fetcher).not.toHaveBeenCalled();
    expect(s.command).not.toHaveBeenCalled();
  },
);
it.each(['ci-validate', 'lint', 'typecheck', 'unit-tests', 'build', 'e2e'])(
  'requires the latest successful %s attempt before reading benchmark artifacts',
  async (name) => {
    const s = await setup();
    const index = s.jobs.findIndex((job) => job.name === name);
    const check = s.jobs[index];
    s.jobs.splice(index, 1);
    for (const status of [
      'missing',
      'failed',
      'running',
      'canceled',
      'skipped',
    ]) {
      if (status !== 'missing') s.jobs.push({ ...check, id: 400, status });
      const gitlab = new GitLab(
        s.env.CI_API_V4_URL!,
        '123',
        '100',
        s.fixture.identity.sourceRevision,
        'fixture-token',
        s.fetcher,
      );
      await expect(gitlab.selectedJob()).rejects.toThrow(
        `${name} not successful`,
      );
      if (status !== 'missing') s.jobs.pop();
    }
    // Older success cannot conceal a newer failed retry.
    s.jobs.push(check, { ...check, id: 400, status: 'failed' });
    await expect(publish(s.root, s.env, s)).rejects.toThrow();
    expect(s.command).not.toHaveBeenCalled();
    expect(
      s.fetcher.mock.calls.some(([url]) => String(url).includes('/artifacts/')),
    ).toBe(false);
    // The next successful retry recovers the gate without selecting by outcome.
    s.jobs.push({ ...check, id: 401, status: 'success' });
    const gitlab = new GitLab(
      s.env.CI_API_V4_URL!,
      '123',
      '100',
      s.fixture.identity.sourceRevision,
      'fixture-token',
      s.fetcher,
    );
    await expect(gitlab.selectedJob()).resolves.toMatchObject({
      id: 200,
      name: 'benchmark-journey',
    });
  },
);

it('does not substitute another measurement or legacy job when journey is absent', async () => {
  const s = await setup();
  s.jobs.splice(0, 1);
  expect(await publish(s.root, s.env, s, true)).toMatchObject({
    status: 'not-deployed',
    reason: 'benchmark-absent',
  });
  expect(s.command).not.toHaveBeenCalled();
  expect(
    s.fetcher.mock.calls.some(([url]) => String(url).includes('/artifacts/')),
  ).toBe(false);
});

it.each(['pull', 'pull-secrets'])(
  'reports safe failure at %s without importing or deploying',
  async (phase) => {
    const s = await setup();
    s.command.mockImplementation(async (args) => {
      if (args[0] === 'git-head') return s.fixture.identity.sourceRevision;
      if (args[0] === 'pull') {
        if (phase === 'pull')
          throw providerFailure({
            code: 1,
            stderr: 'npm error code ETARGET token=private-value',
          });
        await writeSafe(
          s.root,
          '.vercel/.env.production.local',
          'NEXT_PUBLIC_SECRET="private-value"',
        );
      }
      return '';
    });
    await expect(publish(s.root, s.env, s)).rejects.toThrow(
      'Publication failed',
    );
    const report = await readFile(
      join(s.root, 'reports/publication.json'),
      'utf8',
    );
    expect(JSON.parse(report)).toMatchObject({
      status: 'failed',
      phase,
      check:
        phase === 'pull' ? 'provider-ETARGET' : 'public credential variable',
    });
    expect(report).not.toContain('private-value');
    expect(s.command.mock.calls.map(([args]) => args[0])).toEqual([
      'git-head',
      'pull',
    ]);
    expect(await readFile(join(s.root, catalogPath), 'utf8')).toBe('[]');
  },
);

it.each([
  {
    code: 1,
    signal: null,
    stdout: 'Type error: private-build-source',
    check: 'provider-build-typescript',
  },
  {
    code: null,
    signal: 'SIGKILL',
    stdout: '',
    check: 'provider-process-signaled',
  },
  {
    code: 2,
    signal: null,
    stdout: 'Unrecognized private-build-source',
    check: 'provider-command-failed',
  },
])(
  'records safe build metadata ($check) and never deploys',
  async (failure) => {
    const s = await setup();
    s.command.mockImplementation(async (args) => {
      if (args[0] === 'git-head') return s.fixture.identity.sourceRevision;
      if (args[0] === 'build')
        throw providerFailure(
          {
            ...failure,
            stderr: `https://user:${s.env.VERCEL_TOKEN}@example.test/?token=unknown-secret`,
          },
          'build',
        );
      return '';
    });
    await expect(publish(s.root, s.env, s)).rejects.toThrow(
      'Publication failed',
    );
    const report = await readFile(
      join(s.root, 'reports/publication.json'),
      'utf8',
    );
    expect(JSON.parse(report)).toMatchObject({
      status: 'failed',
      phase: 'build',
      check: failure.check,
      exitCode: failure.code,
      signal: failure.signal,
    });
    expect(report).not.toMatch(
      /private-build-source|unknown-secret|https:\/\/user/,
    );
    expect(report).not.toContain(s.env.VERCEL_TOKEN!);
    expect(s.command.mock.calls.map(([args]) => args[0])).toEqual([
      'git-head',
      'pull',
      'build',
    ]);
    expect(s.verify).not.toHaveBeenCalled();
  },
);
