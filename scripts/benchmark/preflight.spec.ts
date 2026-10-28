import { test, chromium, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { arch, platform, release, cpus, totalmem } from 'node:os';
import {
  generateMarketRecords,
  MARKET_GENERATOR_VERSION,
} from '../../src/features/market/data/generate-market-records';
import {
  profile,
  checkEnvironment,
  type EnvironmentArtifact,
} from './environment';
const require = createRequire(import.meta.url);
const hash = (bytes: Buffer | string) =>
  createHash('sha256').update(bytes).digest('hex');
test('preflight environment only; no application benchmark', async () => {
  const output = resolve(
    process.env.BENCHMARK_ENV_OUTPUT ?? `artifacts/environment/${Date.now()}`,
  );
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output);
  const artifact: EnvironmentArtifact = {
    schemaVersion: 1,
    profileId: profile.id,
    recordedAt: new Date().toISOString(),
    status: 'failed',
    observed: {},
    failures: [],
    limitations: [
      'CPU/network/cache configuration is acknowledged by CDP, not independently calibrated. No portable CDP getter proves physical CPU slowdown or actual link throughput.',
      'Five measured iterations and dataset identity are validated plans; no app route, performance metric, iteration or comparison is executed.',
      'OS/CPU metadata is observed; power mode, thermal state and background workload require operator control before collection.',
      'Dirty source is reported with patch and untracked-file hashes. A preflight pass alone is not publication or a guarantee of source/build reproducibility.',
    ],
  };
  const o = artifact.observed;
  try {
    o.nodeVersion = process.versions.node;
    o.yarnVersion = execFileSync('yarn', ['--version'], {
      encoding: 'utf8',
    }).trim();
    o.playwrightVersion = require('playwright-core/package.json').version;
    const status = execFileSync('git', ['status', '--porcelain'], {
      encoding: 'utf8',
    });
    const patch = execFileSync('git', ['diff', '--binary', 'HEAD'], {
      maxBuffer: 20 * 1024 * 1024,
    });
    o.source = {
      commitSha: execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim(),
      dirty: status.length > 0,
      status,
      patchSha256: hash(patch),
    };
    await writeFile(join(output, 'source.patch'), patch);
    const untracked = execFileSync(
      'git',
      ['ls-files', '--others', '--exclude-standard', '-z'],
      { encoding: 'utf8' },
    )
      .split('\0')
      .filter(Boolean);
    const inventory = [];
    for (const path of untracked)
      if (!resolve(path).startsWith(output + '/'))
        inventory.push({ path, sha256: hash(await readFile(path)) });
    await writeFile(
      join(output, 'untracked-files.json'),
      JSON.stringify(inventory, null, 2) + '\n',
    );
    o.os = {
      platform: platform(),
      release: release(),
      arch: arch(),
      cpu: cpus()[0]?.model ?? '',
      totalMemory: totalmem(),
    };
    const records = generateMarketRecords({
      seed: profile.seed,
      count: profile.recordCount,
    });
    o.dataset = {
      seed: profile.seed,
      recordCount: records.length,
      generatorVersion: MARKET_GENERATOR_VERSION,
      schemaVersion: 1,
      sha256: hash(JSON.stringify(records)),
    };
    o.plan = {
      measuredIterations: profile.measuredIterations,
      warmupIterations: profile.warmupIterations,
      cacheState: profile.cacheState,
    };
    const metadata = JSON.parse(
      await readFile(
        join(
          dirname(require.resolve('playwright-core/package.json')),
          'browsers.json',
        ),
        'utf8',
      ),
    ).browsers.find((entry: { name: string }) => entry.name === 'chromium');
    const executable = chromium.executablePath();
    const executableSha = hash(await readFile(executable));
    // Explicit full CfT executable: do not silently substitute the default headless shell.
    const browser = await chromium.launch({
      executablePath: executable,
      headless: profile.headless,
    });
    try {
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
      const cdp = await context.newCDPSession(page);
      const version = await cdp.send('Browser.getVersion');
      o.browser = {
        version: browser.version(),
        revision: metadata.revision,
        distribution: metadata.title,
        executable,
        sha256: executableSha,
        product: version.product,
      };
      await cdp.send('Network.enable');
      await cdp.send('Network.clearBrowserCache');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await cdp.send('Emulation.setCPUThrottlingRate', {
        rate: profile.cpuRate,
      });
      await cdp.send('Network.emulateNetworkConditions', profile.network);
      o.applied = {
        cpuRate: profile.cpuRate,
        network: { ...profile.network },
        cacheDisabled: true,
        cacheCleared: true,
        freshContext: true,
        serviceWorkers: 'block',
        headless: profile.headless,
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
      o.viewport = {
        width: actual.width,
        height: actual.height,
        deviceScaleFactor: actual.deviceScaleFactor,
      };
      o.locale = actual.locale;
      o.timezoneId = actual.timezoneId;
      o.online = actual.online;
      o.reducedMotion = actual.reducedMotion;
      const storage = await context.storageState();
      o.storage = {
        cookies: storage.cookies.length,
        origins: storage.origins.length,
      };
    } finally {
      await browser.close();
    }
  } catch (error) {
    artifact.failures.push(
      error instanceof Error ? error.message : String(error),
    );
  }
  artifact.failures.push(...checkEnvironment(o));
  artifact.status = artifact.failures.length ? 'failed' : 'passed';
  await writeFile(
    join(output, 'environment.json'),
    JSON.stringify(artifact, null, 2) + '\n',
  );
  console.log(`Environment artifact: ${output}`);
  expect(artifact.failures, JSON.stringify(artifact.failures, null, 2)).toEqual(
    [],
  );
});
