import { requiredCheckJobs } from './required-jobs.ts';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
// js-yaml is ESLint's declared dependency; resolve through that installed package.
const eslintRequire = createRequire(require.resolve('eslint/package.json'));
const { load } = eslintRequire('js-yaml');
const config = load(readFileSync('.gitlab-ci.yml', 'utf8'));
assert.deepEqual(config.stages, [
  'correctness',
  'e2e',
  'benchmark',
  'publication',
]);
assert.equal(config.default.image, 'node:24.19.0-bookworm-slim');
assert.deepEqual(config.default.tags, ['performance-lab-dedicated']);
for (const [name, job] of Object.entries(config)) {
  if (!job?.script) continue;
  assert.deepEqual(
    job.tags ?? config.default.tags,
    ['performance-lab-dedicated'],
    `${name} must use the existing self-hosted Docker runner`,
  );
  assert(
    job.inherit !== false &&
      job.inherit?.default !== false &&
      (!Array.isArray(job.inherit?.default) ||
        job.inherit.default.includes('tags')),
    `${name} must inherit runner tags`,
  );
}
const setup = config.default.before_script;
const installGit = setup.indexOf(
  'apt-get install -y --no-install-recommends git ca-certificates',
);
assert(installGit > setup.indexOf('apt-get update'));
assert(setup.indexOf('apt-get update') >= 0);
assert(installGit >= 0, 'The slim image needs Git installed explicitly');
assert(setup.indexOf('git --version') > installGit);
assert(
  setup.indexOf('git diff --exit-code -- yarn.lock package.json') > installGit,
  'Install Git before checking lockfile changes',
);
assert(
  config.default.before_script.some((s) => s.includes('--frozen-lockfile')),
);
assert.deepEqual(config.default.cache.paths, ['.yarn-cache/']);
assert.deepEqual(config.default.cache.key.files, ['yarn.lock']);
assert(!Object.hasOwn(config, 'correctness'), 'Checks must be separate jobs');
const commands = {
  'ci-validate': ['yarn ci:validate'],
  lint: ['yarn lint'],
  typecheck: ['yarn typecheck'],
  'unit-tests': [
    'yarn test --reporter=default --reporter=junit --outputFile=reports/unit.xml',
  ],
  build: ['yarn build'],
  e2e: [
    'yarn playwright install --with-deps chromium',
    'yarn test:e2e --workers=1 --retries=0 --reporter=list,junit',
  ],
};
assert.deepEqual(Object.keys(commands), [...requiredCheckJobs]);
for (const name of requiredCheckJobs) {
  assert.equal(config[name].allow_failure, false);
  assert.equal(config[name].stage, name === 'e2e' ? 'e2e' : 'correctness');
  assert.deepEqual(config[name].script, commands[name]);
  assert(!config[name].rules, 'All checks run on every supported pipeline');
  if (name !== 'e2e')
    assert(!config[name].needs, 'Initial checks run in parallel');
}
assert.deepEqual(config.e2e.needs, [{ job: 'build', artifacts: true }]);
assert.deepEqual(config.build.artifacts.paths, ['.next/']);
assert.deepEqual(config.build.artifacts.exclude, ['.next/cache/**/*']);
assert.equal(config.build.artifacts.when, 'on_success');
assert.equal(config.build.artifacts.expire_in, '1 day');
for (const name of ['unit-tests', 'e2e']) {
  assert.equal(config[name].artifacts.when, 'always');
  assert.equal(config[name].artifacts.expire_in, '7 days');
}
assert.equal(config['unit-tests'].artifacts.reports.junit, 'reports/unit.xml');
assert.equal(config.e2e.artifacts.reports.junit, 'test-results/e2e.xml');
const measurementFlags = {
  'benchmark-journey': 'RUN_BENCHMARKS',
  'benchmark-lighthouse': 'RUN_LIGHTHOUSE',
  'benchmark-bundle': 'RUN_BUNDLE',
  'benchmark-memory': 'RUN_MEMORY',
};
assert(!config.benchmark && !config.memory, 'Use the named measurement jobs');
for (const [name, flag] of Object.entries(measurementFlags)) {
  const job = config[name];
  assert.equal(job.stage, 'benchmark');
  assert(!job.needs, 'Measurements must wait for all checks including E2E');
  assert.deepEqual(
    job.dependencies,
    [],
    'Collectors must not download correctness build output',
  );
  assert.deepEqual(job.tags, ['performance-lab-dedicated']);
  assert(
    job.rules.every(
      (rule) =>
        rule.when === 'never' || rule.if.includes('CI_COMMIT_REF_PROTECTED'),
    ),
  );
  assert(job.rules.some((rule) => rule.when === 'manual'));
  assert.equal(job.allow_failure, true);
  assert.equal(job.interruptible, false);
  assert.deepEqual(job.cache, []);
  assert(job.rules[0].if.includes(`$${flag} == "true"`));
  assert(job.rules[0].if.includes('CI_PIPELINE_SOURCE == "schedule"'));
  if (name === 'benchmark-journey' || name === 'benchmark-lighthouse') {
    assert.deepEqual(job.script, [
      'yarn playwright install --with-deps chromium',
      'yarn benchmark:preflight',
      'yarn benchmark:compare "$BENCHMARK_EXPERIMENT"' +
        (name === 'benchmark-lighthouse' ? ' --lighthouse' : ''),
    ]);
    assert(job.artifacts.paths.includes('artifacts/'));
  } else {
    assert(job.script.includes('yarn build'));
    assert.equal(
      job.script.at(-1),
      name === 'benchmark-bundle'
        ? 'yarn bundle:analyze --retries=0'
        : 'yarn memory:journey',
    );
    assert(job.script.indexOf('yarn benchmark:preflight') >= 0);
    assert(
      job.script.indexOf('yarn benchmark:preflight') < job.script.length - 1,
    );
  }
  assert.equal(job.artifacts.when, 'always');
  assert.equal(job.artifacts.expire_in, '30 days');
  assert.equal(job.resource_group, 'performance-lab-measurement');
}
const scripts = JSON.parse(readFileSync('package.json')).scripts;
for (const job of [...requiredCheckJobs, ...Object.keys(measurementFlags)])
  for (const command of config[job].script) {
    const parts = command.split(' ');
    const name = parts[0] === 'npm' && parts[1] === 'run' ? parts[2] : parts[1];
    assert(
      name === 'playwright' || Object.hasOwn(scripts, name),
      `Missing package script ${name}`,
    );
  }

const publication = config.publication;
assert.equal(publication.stage, 'publication');
assert.equal(publication.interruptible, false);
assert.equal(publication.resource_group, 'performance-lab-production');
assert.equal(publication.environment.name, 'production');
assert.deepEqual(publication.needs, [
  ...requiredCheckJobs.map((job) => ({ job, artifacts: false })),
  { job: 'benchmark-journey', artifacts: false, optional: true },
]);
assert.deepEqual(
  publication.rules.map((rule) => rule.when),
  ['always', 'never'],
);
for (const gate of [
  'PUBLICATION_ENABLED',
  'CI_COMMIT_REF_PROTECTED',
  'CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH',
  'CI_PIPELINE_SOURCE != "merge_request_event"',
])
  assert(publication.rules[0].if.includes(gate));
assert.deepEqual(publication.script, ['node scripts/publication/cli.ts']);
assert.equal(publication.artifacts.when, 'always');
assert.equal(publication.artifacts.access, 'maintainer');
for (const path of [
  'scripts/publication/cli.ts',
  'scripts/benchmark/import-cli.ts',
  'scripts/publication/verify-output.ts',
])
  assert(existsSync(path), `Missing publication implementation ${path}`);
assert(
  !publication.needs.some((need) =>
    ['benchmark-memory', 'benchmark-bundle', 'benchmark-lighthouse'].includes(
      need.job,
    ),
  ),
);
assert(
  !publication.artifacts.paths.some(
    (path) =>
      path.startsWith('.vercel') || path === 'artifacts/publication-source/',
  ),
);
assert(!Object.hasOwn(config.variables, 'PUBLICATION_ENABLED'));

const dryRun = config['publication-dry-run'];
assert.equal(dryRun.stage, 'publication');
assert.deepEqual(dryRun.environment, { name: 'production', action: 'verify' });
assert.deepEqual(dryRun.needs, publication.needs);
assert.equal(dryRun.resource_group, publication.resource_group);
assert.deepEqual(dryRun.script, ['node scripts/publication/cli.ts --dry-run']);
assert.deepEqual(
  dryRun.rules.map((rule) => rule.when),
  ['on_success', 'never'],
);
for (const gate of [
  'PUBLICATION_DRY_RUN == "true"',
  'CI_COMMIT_REF_PROTECTED == "true"',
  'CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH',
  'CI_PIPELINE_SOURCE != "merge_request_event"',
])
  assert(dryRun.rules[0].if.includes(gate));
assert(publication.rules[0].if.includes('PUBLICATION_DRY_RUN != "true"'));
assert.equal(dryRun.artifacts.access, 'maintainer');
assert.deepEqual(dryRun.artifacts.paths, [
  'reports/publication.json',
  'reports/publication-import.json',
]);
assert(!Object.hasOwn(config.variables, 'PUBLICATION_DRY_RUN'));

console.log(
  'CI YAML parses; local pipeline invariants pass. GitLab server lint and runner execution are separate checks.',
);
