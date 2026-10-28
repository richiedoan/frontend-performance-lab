import { drawerJourney } from './drawer-journey';
import { fieldInp, aggregateLighthouse } from './lighthouse-results';
import { collectLighthouse } from './lighthouse-collector';
import { journeyReadinessPolicy, waitForDataset } from './dataset-readiness';
import { test, expect, chromium } from '@playwright/test';
import type { Browser } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { startMemoryServer } from '../memory/server';
import {
  profile,
  checkEnvironment,
  type EnvironmentArtifact,
} from './environment';
import {
  schedule,
  summarize,
  writeEvidence,
  type Options,
  type Iteration,
} from './runner-model';
async function command(args: string[], path: string, env = process.env) {
  const log = createWriteStream(path, { flags: 'wx' });
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('yarn', args, {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout.pipe(log, { end: false });
      child.stderr.pipe(log, { end: false });
      child.once('error', reject);
      child.once('exit', (code) =>
        code === 0
          ? resolve()
          : reject(
              new Error(`yarn ${args.join(' ')} exited ${code}; see ${path}`),
            ),
      );
    });
  } finally {
    await new Promise<void>((resolve) => log.end(resolve));
  }
}
test('production collection with retained raw iterations', async () => {
  const directory = process.env.BENCHMARK_RUN_DIRECTORY;
  if (!directory || !process.env.BENCHMARK_RUN_OPTIONS)
    throw new Error('Use yarn benchmark CLI');
  const options = JSON.parse(process.env.BENCHMARK_RUN_OPTIONS) as Options;
  const results: Iteration[] = [];
  let server: Awaited<ReturnType<typeof startMemoryServer>> | undefined;
  let lighthouseComplete = false;
  let setupFailure: string | undefined;
  try {
    await command(['benchmark:preflight'], join(directory, 'preflight.txt'), {
      ...process.env,
      BENCHMARK_ENV_OUTPUT: join(directory, 'environment'),
    });
    await command(['build'], join(directory, 'build.txt'));
    await writeEvidence(directory, 'build.json', {
      sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim(),
      mode: 'production',
      command: 'yarn build',
      buildId: (await readFile('.next/BUILD_ID', 'utf8')).trim(),
      lockfileSha256: createHash('sha256')
        .update(await readFile('yarn.lock'))
        .digest('hex'),
    });
    const environment = JSON.parse(
      await readFile(join(directory, 'environment/environment.json'), 'utf8'),
    ) as EnvironmentArtifact;
    if (environment.status !== 'passed')
      throw new Error('Preflight did not pass');
    server = await startMemoryServer();
    if (options.lighthouse) {
      const passed = await collectLighthouse(directory, options, environment);
      lighthouseComplete = true;
      if (!passed)
        throw new Error(
          'Lighthouse collection has unavailable metrics; see summary.json',
        );
      return;
    }
    for (const item of schedule(options.routes)) {
      const evidencePath = `${item.route}-${item.iteration}.json`;
      const errors: string[] = [];
      let browser: Browser | undefined;
      let result: Iteration;
      const startedAt = new Date().toISOString();
      const observed = structuredClone(environment.observed);
      let phase = 'setup';
      const timings: Record<string, number> = {};
      try {
        browser = await chromium.launch({
          executablePath: chromium.executablePath(),
          headless: profile.headless,
        });
        const context = await browser.newContext({
          viewport: {
            width: profile.viewport.width,
            height: profile.viewport.height,
          },
          deviceScaleFactor: profile.viewport.deviceScaleFactor,
          locale: profile.locale,
          timezoneId: profile.timezoneId,
          serviceWorkers: 'block',
          reducedMotion: 'no-preference',
        });
        const page = await context.newPage();
        page.setDefaultTimeout(60000);
        page.setDefaultNavigationTimeout(90000);
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('response', (response) => {
          if (response.status() >= 400)
            errors.push(`HTTP ${response.status()} ${response.url()}`);
        });
        const cdp = await context.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.clearBrowserCache');
        await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
        await cdp.send('Emulation.setCPUThrottlingRate', {
          rate: profile.cpuRate,
        });
        await cdp.send('Network.emulateNetworkConditions', profile.network);
        observed.applied = {
          cpuRate: profile.cpuRate,
          network: { ...profile.network },
          cacheDisabled: true,
          cacheCleared: true,
          freshContext: true,
          serviceWorkers: 'block',
          headless: profile.headless,
        };
        observed.browser = {
          ...environment.observed.browser!,
          version: browser.version(),
          product: (await cdp.send('Browser.getVersion')).product,
        };
        const actual = await page.evaluate(() => ({
          width: innerWidth,
          height: innerHeight,
          deviceScaleFactor: devicePixelRatio,
          locale: navigator.language,
          timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
          online: navigator.onLine,
          reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        }));
        observed.viewport = {
          width: actual.width,
          height: actual.height,
          deviceScaleFactor: actual.deviceScaleFactor,
        };
        observed.locale = actual.locale;
        observed.timezoneId = actual.timezoneId;
        observed.online = actual.online;
        observed.reducedMotion = actual.reducedMotion;
        const storage = await context.storageState();
        observed.storage = {
          cookies: storage.cookies.length,
          origins: storage.origins.length,
        };
        const mismatches = checkEnvironment(observed);
        if (mismatches.length) throw new Error(mismatches.join('\n'));
        const params = new URLSearchParams({
          scenario: options.experiment,
          seed: String(profile.seed),
          count: String(profile.recordCount),
          delayMs: '0',
        });
        const apiParams = new URLSearchParams(params);
        apiParams.delete('scenario');
        apiParams.set('simulateError', 'false');
        const start = performance.now();
        phase = 'navigation-and-dataset';
        const [, response] = await Promise.all([
          waitForDataset(page, apiParams.toString()),
          page.goto(`http://127.0.0.1:3101/${item.route}?${params}`),
        ]);
        if (!response?.ok()) throw new Error('Dashboard navigation failed');
        timings.datasetReadyMs = performance.now() - start;
        phase = 'table';
        await expect(page.getByTestId('market-table')).toBeVisible({
          timeout: journeyReadinessPolicy.tableTimeoutMs,
        });
        timings.tableReadyMs = performance.now() - start;
        phase = 'drawer-journey';
        await drawerJourney(page);
        const value = performance.now() - start;
        timings.journeyMs = value;
        if (errors.length) throw new Error(errors.join('\n'));
        result = { ...item, evidencePath, status: 'passed', value };
      } catch (error) {
        result = {
          ...item,
          evidencePath,
          status: 'failed',
          reason: error instanceof Error ? error.message : String(error),
        };
      } finally {
        try {
          await browser?.close();
        } catch (error) {
          errors.push(`Browser cleanup: ${String(error)}`);
        }
      }
      if (errors.length && result.status === 'passed')
        result = {
          ...item,
          evidencePath,
          status: 'failed',
          reason: errors.join('\n'),
        };
      await writeEvidence(directory, evidencePath, {
        ...result,
        unit: 'ms',
        startedAt,
        endedAt: new Date().toISOString(),
        observed,
        errors,
        readinessPolicy: journeyReadinessPolicy,
        phase,
        timings,
        scenario: options.experiment,
        seed: profile.seed,
        recordCount: profile.recordCount,
      });
      results.push(result);
    }
  } catch (error) {
    setupFailure = error instanceof Error ? error.message : String(error);
  } finally {
    if (server) {
      await server.close();
      await writeFile(join(directory, 'server.txt'), server.log(), {
        flag: 'wx',
      });
    }
    if (!lighthouseComplete) {
      // Setup failures still receive one explicit failed record for every unexecuted slot.
      for (const item of schedule(options.routes)) {
        if (
          results.some(
            (result) =>
              result.route === item.route &&
              result.iteration === item.iteration,
          )
        )
          continue;
        const evidencePath = `${item.route}-${item.iteration}.json`;
        const result: Iteration = {
          ...item,
          evidencePath,
          status: 'failed',
          reason: setupFailure ?? 'Collection interrupted before iteration',
        };
        await writeEvidence(directory, evidencePath, {
          ...result,
          ...(options.lighthouse
            ? {
                collector: 'lighthouse',
                fieldInp,
                metrics: aggregateLighthouse([]),
              }
            : {}),
        });
        results.push(result);
      }
      await writeEvidence(directory, 'summary.json', {
        status: results.every((result) => result.status === 'passed')
          ? 'completed'
          : 'failed',
        setupFailure,
        ...(!options.lighthouse
          ? { readinessPolicy: journeyReadinessPolicy }
          : {}),
        ...(options.lighthouse ? { collector: 'lighthouse', fieldInp } : {}),
        metric: options.lighthouse
          ? 'Lighthouse navigation metrics unavailable'
          : 'dashboard-detail-dashboard journey duration (automation-inclusive)',
        rawInputs: results.map((result) => result.evidencePath),
        routes: Object.fromEntries(
          options.routes.map((route) => [
            route,
            options.lighthouse
              ? aggregateLighthouse(
                  results
                    .filter((result) => result.route === route)
                    .map((result) => ({
                      iteration: result.iteration,
                      evidencePath: result.evidencePath,
                      metrics: {},
                    })),
                )
              : summarize(results, route),
          ]),
        ),
        limitations: [
          'Not field INP, LCP or heap-retention measurement.',
          'A common drawer journey does not exercise each scenario-specific workload.',
          'Five iterations are not evidence of statistical significance; no speedup inferred.',
          'External interruption may leave a partial directory; missing summary means incomplete.',
        ],
      });
    }
  }
  if (lighthouseComplete) {
    expect(setupFailure).toBeUndefined();
    return;
  }
  expect(results.filter((result) => result.status === 'failed')).toEqual([]);
});
