import { layerAttribution } from './diagnostic-layers';
import {
  selectCssControl,
  installCssControl,
  inspectCssWorkload,
} from './diagnostic-css';
import { drawerJourney } from './drawer-journey';
import { test, expect, chromium } from '@playwright/test';
import type {
  Browser,
  BrowserContext,
  CDPSession,
  Page,
} from '@playwright/test';
import { appendFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { startMemoryServer } from '../memory/server';
import { profile } from './environment';
import { waitForDataset, journeyReadinessPolicy } from './dataset-readiness';
import { boundedCleanup, diagnosticPhases } from './diagnostic-model';
import type { Options } from './runner-model';

test('single diagnostic journey (never publication evidence)', async () => {
  const directory = process.env.DIAGNOSTIC_DIRECTORY;
  if (!directory) throw new Error('Use npm run benchmark:diagnostic');
  const options = JSON.parse(process.env.DIAGNOSTIC_OPTIONS!) as Options;
  function persist(name: string, value: unknown) {
    const path = join(directory!, name);
    writeFileSync(`${path}.tmp`, JSON.stringify(value, null, 2) + '\n');
    renameSync(`${path}.tmp`, path);
  }
  const phase = diagnosticPhases(
    (value) => persist('journey-phases.json', value),
    new AbortController().signal,
  );
  const events: unknown[] = [];
  const record = (kind: string, data: unknown) => {
    events.push({
      kind,
      timestamp: new Date().toISOString(),
      monotonicMs: performance.now(),
      data,
    });
    persist('events.json', events);
  };
  let server: Awaited<ReturnType<typeof startMemoryServer>> | undefined;
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let cdp: CDPSession | undefined;
  let page: Page | undefined;
  let attribution: ReturnType<typeof layerAttribution> | undefined;
  let scrollCaptured = false;
  let scrollCapture: Promise<void> | undefined;
  let tracing = false;
  let chromeChunks = 0;
  const chromePath = join(directory, 'chrome-trace.json');
  const appendChrome = ({ value }: { value: unknown[] }) => {
    if (!value.length) return;
    appendFileSync(
      chromePath,
      `${chromeChunks++ ? ',' : ''}${JSON.stringify(value).slice(1, -1)}`,
    );
  };
  try {
    server = await phase('server', startMemoryServer);
    browser = await chromium.launch({
      executablePath: chromium.executablePath(),
      headless: profile.headless,
    });
    context = await browser.newContext({
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
    page = await context.newPage();
    const p = page;
    p.setDefaultTimeout(60000);
    p.setDefaultNavigationTimeout(90000);
    p.on('pageerror', (error) => record('pageerror', error.message));
    p.on('requestfailed', (request) =>
      record('requestfailed', { url: request.url(), error: request.failure() }),
    );
    const requestStarts = new Map<string, number>();
    p.on('request', (request) => {
      if (/\/api\/markets(?:\/summary)?\?/.test(request.url())) {
        requestStarts.set(request.url(), performance.now());
        record('dataset-request-start', request.url());
      }
    });
    p.on('response', (response) => {
      if (response.status() >= 400)
        record('http-failure', {
          url: response.url(),
          status: response.status(),
        });
      if (/\/api\/markets(?:\/summary)?\?/.test(response.url())) {
        const headersAt = performance.now();
        record('response-headers', response.url());
        void response.finished().then((error) =>
          record('response-body-finished', {
            url: response.url(),
            error: error?.message ?? null,
            bodyAfterHeadersMs: performance.now() - headersAt,
            requestToBodyMs: requestStarts.has(response.url())
              ? performance.now() - requestStarts.get(response.url())!
              : null,
          }),
        );
      }
    });
    await p.exposeBinding('diagnosticEvent', (_, value) => {
      record('dom-event-observed', value);
      if (value.type === 'scroll' && !scrollCaptured && attribution) {
        scrollCaptured = true;
        scrollCapture = attribution.capture('after-first-observed-scroll');
      }
    });
    const cssControl = selectCssControl([
      `--css-control=${process.env.DIAGNOSTIC_CSS_CONTROL ?? 'none'}`,
    ]);
    const cssEvidence: unknown[] = [];
    await installCssControl(p, cssControl, (value) => {
      cssEvidence.push(value);
      persist('css-control.json', cssEvidence);
    });
    await p.addInitScript(() => {
      for (const type of ['pointerdown', 'click', 'scroll', 'focusin']) {
        document.addEventListener(
          type,
          (event) => {
            const target = event.target;
            const value = {
              type,
              timeOrigin: performance.timeOrigin,
              now: performance.now(),
              trusted: event.isTrusted,
              hitTarget:
                event instanceof PointerEvent || event instanceof MouseEvent
                  ? document
                      .elementFromPoint(event.clientX, event.clientY)
                      ?.getAttribute('data-testid')
                  : null,
              rect:
                target instanceof Element &&
                (event.type === 'click' || event.type === 'pointerdown')
                  ? target.getBoundingClientRect().toJSON()
                  : null,
              target:
                target instanceof Element
                  ? target.closest('[data-testid]')?.getAttribute('data-testid')
                  : null,
            };
            performance.mark(`diagnostic:${type}:${value.target}`);
            void (
              window as unknown as {
                diagnosticEvent: (value: unknown) => Promise<void>;
              }
            ).diagnosticEvent(value);
          },
          { capture: true, passive: true },
        );
      }
    });
    cdp = await context.newCDPSession(p);
    await cdp.send('Network.enable');
    await cdp.send('Network.clearBrowserCache');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuRate });
    await cdp.send('Network.emulateNetworkConditions', profile.network);
    persist('applied.json', {
      profile,
      browser: await cdp.send('Browser.getVersion'),
      cacheCleared: true,
      cacheDisabled: true,
      freshContext: true,
    });
    if (process.env.DIAGNOSTIC_TRACE === 'chrome') {
      writeFileSync(chromePath, '{"traceEvents":[');
      cdp.on('Tracing.dataCollected', appendChrome);
      await cdp.send('Tracing.start', {
        categories:
          'devtools.timeline,v8,blink.user_timing,disabled-by-default-devtools.timeline,disabled-by-default-v8.cpu_profiler',
        transferMode: 'ReportEvents',
      });
    } else {
      await context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true,
      });
    }
    if (process.env.DIAGNOSTIC_ATTRIBUTION === 'layers') {
      attribution = layerAttribution(await context.newCDPSession(p), (value) =>
        persist('layer-attribution.json', value),
      );
      await attribution.start();
    }
    tracing = true;
    const params = new URLSearchParams({
      scenario: options.experiment,
      seed: String(profile.seed),
      count: String(profile.recordCount),
      delayMs: '0',
    });
    const apiParams = new URLSearchParams(params);
    apiParams.delete('scenario');
    apiParams.set('simulateError', 'false');
    await Promise.all([
      phase('dataset-bodies', () => waitForDataset(p, apiParams.toString())),
      phase('navigation', async () => {
        const response = await p.goto(
          `http://127.0.0.1:3101/${options.routes[0]}?${params}`,
        );
        if (!response?.ok()) throw new Error('Dashboard navigation failed');
        await attribution?.capture('after-navigation');
      }),
    ]);
    await phase('table', () =>
      expect(p.getByTestId('market-table')).toBeVisible({
        timeout: journeyReadinessPolicy.tableTimeoutMs,
      }),
    );
    persist(
      'css-before-journey.json',
      await phase('css-workload-before-click', () =>
        p.evaluate(inspectCssWorkload),
      ),
    );
    await attribution?.capture('after-table-before-click');
    await drawerJourney(p, phase);
    persist(
      'css-after-journey.json',
      await phase('css-workload-after-focus', () =>
        p.evaluate(inspectCssWorkload),
      ),
    );
    if (
      events.some((entry) =>
        ['pageerror', 'requestfailed', 'http-failure'].includes(
          (entry as { kind: string }).kind,
        ),
      )
    )
      throw new Error('Page or request failures; see events.json');
  } catch (error) {
    record('failure', String(error));
    if (page) {
      await page
        .screenshot({ path: join(directory, 'failure.png'), timeout: 3000 })
        .catch((error) => record('screenshot-failure', String(error)));
    }
    throw error;
  } finally {
    await scrollCapture;
    await attribution?.close();
    // Parent watchdog bounds cleanup even when a renderer/CDP session is unresponsive.
    if (tracing && process.env.DIAGNOSTIC_TRACE === 'chrome' && cdp) {
      let completeTrace = false;
      try {
        const complete = new Promise<void>((resolve) =>
          cdp!.once('Tracing.tracingComplete', () => resolve()),
        );
        await boundedCleanup(async () => {
          await cdp!.send('Tracing.end');
          await complete;
        }, 30000);
        completeTrace = true;
      } catch (error) {
        record('trace-cleanup-failure', String(error));
      } finally {
        cdp.removeListener('Tracing.dataCollected', appendChrome);
        appendFileSync(chromePath, `],"incomplete":${!completeTrace}}`);
      }
    } else if (tracing) {
      await boundedCleanup(async () =>
        context?.tracing.stop({
          path: join(directory, 'playwright-trace.zip'),
        }),
      ).catch((error) => record('trace-cleanup-failure', String(error)));
    }
    await boundedCleanup(async () => browser?.close()).catch((error) =>
      record('browser-cleanup-failure', String(error)),
    );
    if (server) {
      await boundedCleanup(() => server!.close()).catch((error) =>
        record('server-cleanup-failure', String(error)),
      );
      writeFileSync(join(directory, 'server.txt'), server.log());
    }
    record('cleanup-finished', null);
    if (
      events.some((entry) =>
        (entry as { kind: string }).kind.endsWith('cleanup-failure'),
      )
    ) {
      throw new Error('Diagnostic cleanup incomplete; see events.json');
    }
  }
});
