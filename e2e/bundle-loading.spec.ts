import { expect, test } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describeAsset, summarizeAssets } from '../scripts/bundle/sizes';
import { marketJourney } from './helpers/market-journey';
import { generateMarketRecords } from '../src/features/market/data/generate-market-records';

test('cold initial/lazy chart bundles and drawer functionality match', async ({
  browser,
  baseURL,
}) => {
  const results = [];
  let expectedPoints: string | null = null;
  for (const route of ['/baseline', '/optimized']) {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    const assets = new Map<
      string,
      { body: Buffer; asset: ReturnType<typeof describeAsset> }
    >();
    const downloads: Promise<void>[] = [];
    page.on('response', (response) => {
      if (new URL(response.url()).pathname.endsWith('.js'))
        downloads.push(
          (async () => {
            const body = await response.body();
            assets.set(response.url(), {
              body,
              asset: describeAsset(response.url(), body),
            });
          })(),
        );
    });
    await page.goto(`${route}?scenario=bundle-loading&seed=20260911&count=3`);
    const journey = marketJourney(page);
    await journey.expectState('success');
    await page.waitForLoadState('networkidle');
    await Promise.all(downloads);
    const initial = new Map(assets);
    const containsChart = (entries: typeof assets) =>
      [...entries.values()].some((entry) =>
        entry.body.includes('detail-chart-svg'),
      );
    expect(containsChart(initial)).toBe(route === '/baseline');
    let release = () => {};
    if (route === '/optimized') {
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route('**/*.js', async (request) => {
        await gate;
        await request.continue();
      });
    }
    const record = generateMarketRecords({ seed: 20260911, count: 3 })[0];
    await journey.openDetail(record.id);
    let fallbackHeight: number | undefined;
    if (route === '/optimized') {
      await expect(
        page
          .getByRole('status', { name: '' })
          .filter({ hasText: 'Loading price history' }),
      ).toBeVisible();
      fallbackHeight = (await page.locator('.market-chart').boundingBox())!
        .height;
      await journey.closeDetail(record.id);
      await journey.openDetail(record.id);
      release();
    }
    const chart = page.getByRole('img', {
      name: `Price history for ${record.name}, ${record.chartHistory.length} points in USD`,
    });
    await expect(chart).toBeVisible();
    const points = await chart.locator('polyline').getAttribute('points');
    if (expectedPoints === null) expectedPoints = points;
    else expect(points).toBe(expectedPoints);
    if (fallbackHeight !== undefined)
      expect((await page.locator('.market-chart').boundingBox())!.height).toBe(
        fallbackHeight,
      );
    await journey.closeDetail(record.id);
    await page.waitForLoadState('networkidle');
    await Promise.all(downloads);
    const lazy = new Map([...assets].filter(([url]) => !initial.has(url)));
    expect(containsChart(lazy)).toBe(route === '/optimized');
    const beforeReopen = assets.size;
    await journey.openDetail(record.id);
    await expect(chart).toBeVisible();
    await journey.closeDetail(record.id);
    await page.waitForLoadState('networkidle');
    expect(assets.size).toBe(beforeReopen);
    results.push({
      route,
      initial: summarizeAssets(
        [...initial.values()].map((entry) => entry.asset),
      ),
      lazy: summarizeAssets([...lazy.values()].map((entry) => entry.asset)),
    });
    await context.close();
  }
  if (process.env.BUNDLE_ANALYSIS_DIR) {
    const directory = process.env.BUNDLE_ANALYSIS_DIR;
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, 'report.json'),
      JSON.stringify(
        {
          recordedAt: new Date().toISOString(),
          buildId: (await readFile('.next/BUILD_ID', 'utf8')).trim(),
          node: process.version,
          browser: browser.version(),
          seed: 20260911,
          count: 3,
          method:
            'One cold browser context per route; initial JS before drawer, lazy JS added by first drawer. Decoded response bytes and locally computed gzip bytes, not wire transfer sizes. Shared runtime included; no timing claims.',
          results,
        },
        null,
        2,
      ) + '\n',
    );
  }
});
