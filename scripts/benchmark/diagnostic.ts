import { selectAttribution, layerLimits } from './diagnostic-layers.ts';
import { selectCssControl } from './diagnostic-css.ts';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, renameSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { cpus, totalmem, freemem, platform, arch, release } from 'node:os';
import { profile } from './environment.ts';
import { parseOptions } from './runner-model.ts';
import { journeyReadinessPolicy } from './dataset-readiness.ts';
import { diagnosticPhases, diagnosticLifecycle } from './diagnostic-model.ts';

const attribution = selectAttribution(process.argv.slice(2));
const cssControl = selectCssControl(attribution.args);
const args = cssControl.args;
const traceFlag =
  args.find((arg) => arg.startsWith('--trace=')) ?? '--trace=playwright';
if (!['--trace=playwright', '--trace=chrome'].includes(traceFlag))
  throw new Error('Use --trace=playwright|chrome');
const options = parseOptions([
  ...(args[0] && !args[0].startsWith('--') ? [] : ['large-list']),
  ...args.filter((arg) => arg !== traceFlag),
  ...(args.some((arg) => arg.startsWith('--route='))
    ? []
    : ['--route=baseline']),
]);
if (options.lighthouse) throw new Error('Diagnostic supports journey only');
const directory = resolve(
  'artifacts/diagnostics',
  `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`,
);
mkdirSync(directory, { recursive: true });
function persist(name: string, value: unknown) {
  const path = join(directory, name);
  writeFileSync(`${path}.tmp`, JSON.stringify(value, null, 2) + '\n');
  renameSync(`${path}.tmp`, path);
}
const git = (...args: string[]) =>
  execFileSync('git', args, { encoding: 'utf8' }).trim();
persist('manifest.json', {
  diagnosticOnly: true,
  eligibleForPublication: false,
  options,
  trace: traceFlag,
  attribution: { mode: attribution.mode, limits: layerLimits },
  cssControl: { name: cssControl.name, css: cssControl.css },
  instrumentation: Object.fromEntries(
    [
      'diagnostic.spec.ts',
      'diagnostic-css.ts',
      'diagnostic-layers.ts',
      'drawer-journey.ts',
    ].map((file) => [
      file,
      createHash('sha256')
        .update(readFileSync(join('scripts/benchmark', file)))
        .digest('hex'),
    ]),
  ),
  profile,
  readinessPolicy: journeyReadinessPolicy,
  deadlines: {
    totalMs: 600000,
    workMs: 540000,
    cleanupReserveMs: 60000,
    actionMs: 60000,
    navigationMs: 90000,
    assertionMs: 5000,
  },
  source: {
    revision: git('rev-parse', 'HEAD'),
    status: git('status', '--short'),
    patchSha256: createHash('sha256').update(git('diff', 'HEAD')).digest('hex'),
    lockfileSha256: createHash('sha256')
      .update(readFileSync('yarn.lock'))
      .digest('hex'),
  },
  host: {
    platform: platform(),
    arch: arch(),
    release: release(),
    cpus: cpus(),
    totalmem: totalmem(),
    freemem: freemem(),
    node: process.version,
  },
  plan: [
    'preflight',
    'production build',
    'one fresh-context journey',
    'cleanup',
  ],
  limitations: [
    'Separate tracing modes; timings must not be pooled or published.',
    'Scroll inside locator.click is observable in Playwright trace, not a separate explicit scroll action.',
    'DOM capture observes event delivery, not React handler completion.',
  ],
});
console.log(`Diagnostic: ${directory}`);
if (options.dryRun) {
  persist('status.json', { status: 'dry-run', measured: false });
} else {
  const controller = new AbortController();
  const children = new Set<ReturnType<typeof spawn>>();
  const phase = diagnosticPhases(
    (value) => persist('phases.json', value),
    controller.signal,
  );
  const interrupt = () => controller.abort(new Error('Diagnostic interrupted'));
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  const deadline = setTimeout(
    () => controller.abort(new Error('540000ms work deadline exceeded')),
    540000,
  );
  const kill = () => {
    for (const child of children) {
      try {
        process.kill(-child.pid!, 'SIGKILL');
      } catch {
        /* Already exited. */
      }
    }
  };
  const hardDeadline = setTimeout(() => {
    persist('status.json', {
      status: 'incomplete',
      reason: '600000ms total deadline; forced cleanup',
    });
    kill();
    process.exit(1);
  }, 600000);
  async function command(name: string, argv: string[], extra = {}) {
    await new Promise<void>((resolveCommand, reject) => {
      const child = spawn(process.execPath, argv, {
        detached: true,
        env: { ...process.env, ...extra },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      children.add(child);
      let log = '';
      const save = (chunk: Buffer) => {
        log += String(chunk);
        writeFileSync(join(directory, `${name}.txt`), log);
      };
      child.stdout!.on('data', save);
      child.stderr!.on('data', save);
      child.once('error', reject);
      child.once('exit', (code) =>
        code === 0
          ? resolveCommand()
          : reject(new Error(`${name} exited ${code}`)),
      );
    });
  }
  let status: unknown = { status: 'incomplete' };
  persist('status.json', status);
  try {
    await diagnosticLifecycle(phase, {
      preflight: async () => {
        await command(
          'preflight',
          [
            'node_modules/@playwright/test/cli.js',
            'test',
            '--config',
            'scripts/benchmark/playwright.config.ts',
          ],
          { BENCHMARK_ENV_OUTPUT: join(directory, 'environment') },
        );
        if (
          JSON.parse(
            readFileSync(
              join(directory, 'environment/environment.json'),
              'utf8',
            ),
          ).status !== 'passed'
        )
          throw new Error('Preflight failed');
      },
      build: async () => {
        await command('build', ['node_modules/next/dist/bin/next', 'build']);
        persist('build.json', {
          buildId: readFileSync('.next/BUILD_ID', 'utf8').trim(),
          revision: git('rev-parse', 'HEAD'),
          command: 'node node_modules/next/dist/bin/next build',
          mode: 'production',
        });
      },
      journey: () =>
        command(
          'probe',
          [
            'node_modules/@playwright/test/cli.js',
            'test',
            '--config',
            'scripts/benchmark/diagnostic.config.ts',
          ],
          {
            DIAGNOSTIC_DIRECTORY: directory,
            DIAGNOSTIC_OPTIONS: JSON.stringify(options),
            DIAGNOSTIC_TRACE: traceFlag.slice(8),
            DIAGNOSTIC_CSS_CONTROL: cssControl.name,
            DIAGNOSTIC_ATTRIBUTION: attribution.mode,
          },
        ),
      cleanup: async () => {
        const running = [...children].filter(
          (child) => child.exitCode === null && child.signalCode === null,
        );
        if (running.length) {
          const exits = running.map(
            (child) =>
              new Promise<void>((resolve) =>
                child.once('exit', () => resolve()),
              ),
          );
          for (const child of running) child.kill('SIGTERM');
          let timer: ReturnType<typeof setTimeout> | undefined;
          await Promise.race([
            Promise.all(exits),
            new Promise<void>((resolve) => {
              timer = setTimeout(resolve, 55000);
            }),
          ]);
          clearTimeout(timer);
        }
        kill();
        persist('cleanup.json', {
          completedAt: new Date().toISOString(),
          processGroups: 'task-owned only',
          forcedGroupSweep: true,
        });
      },
    });
    status = { status: 'completed', diagnosticOnly: true };
  } catch (error) {
    status = { status: 'incomplete', reason: String(error) };
    process.exitCode = 1;
  } finally {
    persist('status.json', status);
    clearTimeout(deadline);
    clearTimeout(hardDeadline);
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
}
