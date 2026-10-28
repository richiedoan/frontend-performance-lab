import lighthouse from 'lighthouse';
import puppeteer from 'puppeteer-core';
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  profile,
  checkEnvironment,
  type EnvironmentArtifact,
} from './environment';
import { schedule, writeEvidence, type Options } from './runner-model';
import {
  lighthouseThrottling,
  aggregateLighthouse,
  fieldInp,
  parseLighthouse,
  type Metric,
  type Value,
} from './lighthouse-results';
export const lighthouseSettings = {
  onlyCategories: ['performance'],
  throttlingMethod: 'devtools' as const,
  throttling: lighthouseThrottling,
  disableStorageReset: true,
  screenEmulation: { disabled: true },
  emulatedUserAgent: false as const,
  formFactor: 'desktop' as const,
  locale: 'en-US' as const,
  maxWaitForLoad: 90000,
};
export function lighthouseLaunchArgs(
  platform: NodeJS.Platform = process.platform,
  uid: number | undefined = process.getuid?.(),
) {
  // Chromium cannot start its sandbox as root in the dedicated CI container.
  return [
    '--lang=en-US',
    ...(platform === 'linux' && uid === 0 ? ['--no-sandbox'] : []),
  ];
}
export async function collectLighthouse(
  directory: string,
  options: Options,
  environment: EnvironmentArtifact,
) {
  if (
    environment.status !== 'passed' ||
    checkEnvironment(environment.observed).length
  )
    throw new Error('Validated preflight required before Lighthouse launch');
  const samples: {
    route: string;
    iteration: number;
    evidencePath: string;
    metrics: Partial<Record<Metric, Value>>;
  }[] = [];
  for (const item of schedule(options.routes)) {
    const prefix = `${item.route}-${item.iteration}`;
    const evidencePath = `${prefix}.json`;
    const reportPath = `${prefix}-lighthouse.json`;
    const metrics: Partial<Record<Metric, Value>> = {};
    const failures: string[] = [];
    let cleanupFailed = false;
    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
    const observed = structuredClone(environment.observed);
    const url = `http://127.0.0.1:3101/${item.route}?${new URLSearchParams({ scenario: options.experiment, seed: String(profile.seed), count: String(profile.recordCount), delayMs: '0' })}`;
    try {
      browser = await puppeteer.launch({
        executablePath: chromium.executablePath(),
        headless: true,
        defaultViewport: { ...profile.viewport },
        args: lighthouseLaunchArgs(),
        protocolTimeout: 180000,
      });
      const page = await browser.newPage();
      await page.emulateTimezone(profile.timezoneId);
      await page.setBypassServiceWorker(true);
      await page.setCacheEnabled(false);
      const cdp = await page.createCDPSession();
      await cdp.send('Network.enable');
      await cdp.send('Network.clearBrowserCache');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await cdp.send('Emulation.setLocaleOverride', { locale: profile.locale });
      await cdp.send('Emulation.setCPUThrottlingRate', {
        rate: profile.cpuRate,
      });
      await cdp.send('Network.emulateNetworkConditions', profile.network);
      const version = await cdp.send('Browser.getVersion');
      await cdp.send('Network.setUserAgentOverride', {
        userAgent: version.userAgent,
        acceptLanguage: profile.locale,
      });
      observed.browser = {
        ...environment.observed.browser!,
        version: version.product.split('/')[1],
        product: version.product,
      };
      const actual = await page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        deviceScaleFactor: devicePixelRatio,
        locale: navigator.language,
        timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
        online: navigator.onLine,
      }));
      observed.viewport = {
        width: actual.width,
        height: actual.height,
        deviceScaleFactor: actual.deviceScaleFactor,
      };
      observed.locale = actual.locale;
      observed.timezoneId = actual.timezoneId;
      observed.online = actual.online;
      observed.storage = {
        cookies: (await browser.cookies()).length,
        origins: 0,
      };
      observed.applied = {
        cpuRate: profile.cpuRate,
        network: { ...profile.network },
        cacheDisabled: true,
        cacheCleared: true,
        freshContext: true,
        serviceWorkers: 'block',
        headless: true,
      };
      const mismatch = checkEnvironment(observed);
      if (mismatch.length) throw new Error(mismatch.join('\n'));
      const result = await lighthouse(
        url,
        { ...lighthouseSettings, output: ['json', 'html'] },
        undefined,
        page,
      );
      if (!result) throw new Error('Lighthouse returned no report');
      // Preserve original output before parsing, including reports with audit/runtime errors.
      await writeFile(join(directory, reportPath), result.report[0], {
        flag: 'wx',
      });
      await writeFile(
        join(directory, `${prefix}-lighthouse.html`),
        result.report[1],
        { flag: 'wx' },
      );
      Object.assign(metrics, parseLighthouse(result.lhr, url, reportPath));
      for (const [name, value] of Object.entries(metrics))
        if (value.status === 'not-available')
          failures.push(`${name}: ${value.reason}`);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    } finally {
      try {
        await browser?.close();
      } catch (error) {
        cleanupFailed = true;
        failures.push(`Cleanup: ${String(error)}`);
      }
    }
    if (failures.length && (!Object.keys(metrics).length || cleanupFailed))
      for (const name of [
        'lcp',
        'cls',
        'tbt',
        'speedIndex',
        'transferSize',
        'jsExecution',
      ] as Metric[])
        metrics[name] = {
          status: 'not-available',
          reason: failures.join('\n'),
          evidencePaths: [evidencePath],
        };
    await writeEvidence(directory, evidencePath, {
      ...item,
      evidenceKind: 'real',
      url,
      recordedAt: new Date().toISOString(),
      observed,
      metrics,
      fieldInp,
      failures,
    });
    samples.push({ ...item, evidencePath, metrics });
    console.log(
      `Lighthouse ${prefix}: ${failures.length ? 'failed' : 'completed'}`,
    );
  }
  const routes = Object.fromEntries(
    options.routes.map((route) => [
      route,
      aggregateLighthouse(samples.filter((sample) => sample.route === route)),
    ]),
  );
  const failed = Object.values(routes).some((metrics) =>
    Object.values(metrics).some((value) => value.status !== 'measured'),
  );
  await writeEvidence(directory, 'summary.json', {
    status: failed ? 'failed' : 'completed',
    collector: 'lighthouse',
    evidenceKind: 'real',
    rawInputs: samples.map((sample) => sample.evidencePath),
    routes,
    fieldInp,
  });
  return !failed;
}
