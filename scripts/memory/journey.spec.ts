import { startMemoryServer } from './server';
import { test, chromium, expect } from '@playwright/test';
import type { Browser } from '@playwright/test';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { platform, release, arch, cpus } from 'node:os';
import { marketJourney } from '../../e2e/helpers/market-journey';
import {
  collectCycles,
  MEMORY_READINESS_POLICY,
  measured,
  readMemoryConfig,
  unavailable,
  validateRawMemoryRun,
  type RawMemoryRun,
  type Adapter,
} from './model';
test('collect memory journey without publishing claims', async () => {
  const config = readMemoryConfig(process.env);
  const output = resolve(
    process.env.MEMORY_OUTPUT ??
      `artifacts/memory/${config.mode}-${Date.now()}`,
  );
  if (process.env.MEMORY_VALIDATE_ONLY === '1') {
    if (!process.env.MEMORY_OUTPUT)
      throw new Error('MEMORY_OUTPUT is required for validation');
    const bytes = await readFile(join(output, 'raw-results.json'));
    validateRawMemoryRun(JSON.parse(bytes.toString()));
    const receipt = JSON.parse(
      await readFile(join(output, 'validation.json'), 'utf8'),
    );
    if (
      receipt.valid !== true ||
      receipt.sha256 !== createHash('sha256').update(bytes).digest('hex')
    )
      throw new Error('Artifact checksum mismatch');
    console.log(`Validated memory artifact: ${output}`);
    return;
  }
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output); // Refuse overwrite, including a previous failed attempt.
  const raw: RawMemoryRun = {
    schemaVersion: 1,
    status: 'collecting',
    config,
    environment: {
      node: process.version,
      packageManager: 'yarn@1.22.22',
      platform: platform(),
      release: release(),
      arch: arch(),
      cpu: cpus()[0]?.model ?? 'not-available',
      viewport: { width: 1280, height: 720 },
      headless: true,
      locale: 'en-US',
      timezoneId: 'UTC',
      buildId:
        config.mode === 'dry-run'
          ? 'not-available: dry-run'
          : await readFile('.next/BUILD_ID', 'utf8')
              .then((value) => value.trim())
              .catch(() => 'not-available: build missing'),
      lockSha256: createHash('sha256')
        .update(await readFile('yarn.lock'))
        .digest('hex'),
      warmup: 'none; cold page load followed by 10 sequential detail cycles',
      readinessPolicy: MEMORY_READINESS_POLICY,
      gcMethod: config.forceGc
        ? 'owned page exposed gc() after cleanup'
        : 'disabled',
      metricSources: {
        usedHeap: 'Runtime.getHeapUsage.usedSize',
        domNodes: 'Memory.getDOMCounters.nodes',
        detachedTrees:
          'DOM.getDetachedDomNodes.detachedNodes.length (experimental tree signal)',
      },
      limitations:
        'Raw diagnostic collection only. No exclusions, aggregation across cycles, verified heap attribution or performance claim. Dashboard remains mounted: interval/listener unmount leaks are not exercised by drawer-only cycles.',
    },
    routes: [],
  };
  async function persist() {
    await writeFile(
      join(output, 'raw-results.json.tmp'),
      JSON.stringify(raw, null, 2) + '\n',
    );
    await rename(
      join(output, 'raw-results.json.tmp'),
      join(output, 'raw-results.json'),
    );
  }
  let server: Awaited<ReturnType<typeof startMemoryServer>> | undefined;
  let serverFailure: string | undefined;
  if (config.mode !== 'dry-run')
    try {
      server = await startMemoryServer();
    } catch (error) {
      serverFailure = String(error);
    }
  try {
    for (const route of config.routes) {
      const result: RawMemoryRun['routes'][number] = {
        route,
        browser: { status: 'not-available', reason: 'No browser launched' },
        recordId: null,
        failures: [],
        cycles: [],
      };
      raw.routes.push(result);
      let browser: Browser | undefined;
      let adapter: Adapter | null = null;
      const errors: string[] = [];
      let setupFailure: string | undefined = serverFailure;
      let setupPhase = 'browser';
      if (serverFailure) result.failures.push(serverFailure);
      if (config.mode !== 'dry-run' && !serverFailure)
        try {
          browser = await chromium.launch({
            headless: true,
            channel: config.browser === 'chrome' ? 'chrome' : undefined,
            args: config.flags,
          });
          const context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            locale: 'en-US',
            timezoneId: 'UTC',
            serviceWorkers: 'block',
          });
          const page = await context.newPage();
          page.setDefaultTimeout(MEMORY_READINESS_POLICY.actionTimeoutMs);
          const cdp = await context.newCDPSession(page);
          result.browser = await cdp.send('Browser.getVersion');
          page.on('pageerror', (error) => errors.push(error.message));
          page.on('requestfailed', (request) =>
            errors.push(
              `${request.method()} ${request.url()}: ${request.failure()?.errorText}`,
            ),
          );
          setupPhase = 'navigation';
          await page.goto(`http://127.0.0.1:3101/${route}?${config.query}`, {
            timeout: MEMORY_READINESS_POLICY.navigationTimeoutMs,
          });
          const journey = marketJourney(page);
          setupPhase = 'table-readiness';
          // Both memory variants render the full dataset. Do not inherit the
          // small-fixture E2E assertion deadline for this one-time setup.
          await expect(page.getByTestId('market-table')).toBeVisible({
            timeout: MEMORY_READINESS_POLICY.tableTimeoutMs,
          });
          await journey.expectState('success');
          setupPhase = 'target-record';
          result.recordId = await page
            .getByTestId('market-row')
            .first()
            .getAttribute('data-market-id');
          if (!result.recordId) throw new Error('No target record');
          adapter = {
            async journey() {
              // Recover a failed prior close without resetting dataset/cache or hiding its failure.
              if (await page.getByTestId('market-drawer').isVisible())
                await page.getByTestId('market-close').click();
              await journey.openDetail(result.recordId!);
              await expect(
                page.getByTestId('market-drawer').locator('svg'),
              ).toBeVisible();
              await journey.closeDetail(result.recordId!);
            },
            async cleanup() {
              await expect(page.getByTestId('market-drawer')).toBeHidden();
              await page.evaluate(
                () =>
                  new Promise<void>((resolve) =>
                    requestAnimationFrame(() =>
                      requestAnimationFrame(() => resolve()),
                    ),
                  ),
              );
              await new Promise((resolve) =>
                setTimeout(resolve, config.cleanupMs),
              );
            },
            async gc() {
              await page.evaluate(() => {
                const gc = (
                  globalThis as typeof globalThis & { gc?: () => void }
                ).gc;
                if (typeof gc !== 'function')
                  throw new Error('GC flag not active in owned browser');
                gc();
              });
            },
            async heap() {
              return measured(
                (await cdp.send('Runtime.getHeapUsage')).usedSize,
                'bytes',
              );
            },
            async dom() {
              return measured(
                (await cdp.send('Memory.getDOMCounters')).nodes,
                'nodes',
              );
            },
            async detached() {
              try {
                return measured(
                  (await cdp.send('DOM.getDetachedDomNodes')).detachedNodes
                    .length,
                  'trees',
                );
              } catch (error) {
                const message = String(error);
                if (
                  /not found|wasn't found|not supported|Unknown method/i.test(
                    message,
                  )
                )
                  return unavailable(
                    `DOM.getDetachedDomNodes unsupported: ${message}`,
                  );
                throw error;
              }
            },
            errors() {
              return errors.splice(0);
            },
          };
        } catch (error) {
          setupFailure = `${route} setup (${setupPhase}): ${String(error)}`;
          result.failures.push(setupFailure);
        }
      try {
        await collectCycles(
          config,
          adapter,
          async (cycle) => {
            result.cycles.push(cycle);
            await persist();
          },
          setupFailure,
        );
      } finally {
        result.failures.push(...errors.splice(0));
        try {
          await browser?.close();
        } catch (error) {
          result.failures.push(`Browser cleanup: ${String(error)}`);
        }
      }
    }
  } finally {
    if (server) {
      await server.close();
      await writeFile(join(output, 'server.txt'), server.log());
    }
  }
  raw.status = 'complete';
  await persist();
  const validated = validateRawMemoryRun(
    JSON.parse(await readFile(join(output, 'raw-results.json'), 'utf8')),
  );
  await writeFile(
    join(output, 'validation.json'),
    JSON.stringify(
      {
        valid: true,
        sha256: createHash('sha256')
          .update(await readFile(join(output, 'raw-results.json')))
          .digest('hex'),
        failedCycles: validated.routes
          .flatMap((route) => route.cycles)
          .filter((cycle) => cycle.status === 'failed').length,
        publication:
          'not-available: collection is not a reviewed experiment run',
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Memory artifacts: ${output}`);
  expect(raw.routes.flatMap((route) => route.failures)).toEqual([]);
  expect(
    raw.routes
      .flatMap((route) => route.cycles)
      .filter((cycle) => cycle.status === 'failed'),
  ).toEqual([]);
});
