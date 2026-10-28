import { expect, test } from '@playwright/test';
import { aggregateMarkets } from '../src/features/market/worker-aggregation/aggregate';
import { generateMarketRecords } from '../src/features/market/data/generate-market-records';
import { DEFAULT_MARKET_QUERY } from '../src/features/market/domain/market-query';

for (const route of ['/baseline', '/optimized']) {
  test(`${route} real direct/worker normalized equivalence and workload bounds`, async ({
    page,
  }) => {
    if (route === '/optimized')
      await page.setViewportSize({ width: 390, height: 844 });
    const records = generateMarketRecords({ seed: 20260911, count: 60 });
    await page.goto(
      `${route}?scenario=worker-aggregation&seed=20260911&count=60&aggregationPasses=3`,
    );
    await expect(page.getByTestId('aggregation-output')).toHaveText(
      JSON.stringify(
        aggregateMarkets({ records, query: DEFAULT_MARKET_QUERY, passes: 3 }),
      ),
    );
    await page.getByTestId('market-search').pressSequentially('market 6');
    await page.getByTestId('aggregation-passes').fill('7');
    await expect(page.getByTestId('aggregation-output')).toHaveText(
      JSON.stringify(
        aggregateMarkets({
          records,
          query: { ...DEFAULT_MARKET_QUERY, search: 'market 6' },
          passes: 7,
        }),
      ),
    );
    await expect(page.getByTestId('search-diagnostics')).toHaveCount(0);
    await expect(page.getByTestId('market-virtual-scroll')).toHaveCount(0);
    const events = JSON.parse(
      (await page.getByTestId('aggregation-events').textContent()) ?? '[]',
    );
    for (const event of events)
      expect(event.endedAt).toBeGreaterThanOrEqual(event.startedAt);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByTestId('market-search').fill('no matches');
    await expect(page.getByTestId('aggregation-output')).toHaveText(
      JSON.stringify(
        aggregateMarkets({
          records,
          query: { ...DEFAULT_MARKET_QUERY, search: 'no matches' },
          passes: 7,
        }),
      ),
    );
    await page.getByTestId('aggregation-passes').fill('101');
    await expect(
      page.getByTestId('aggregation-experiment').getByRole('alert'),
    ).toContainText('1 to 100');
    await expect(page.getByTestId('aggregation-output')).toHaveCount(0);
    await page.goto(`${route}?scenario=worker-aggregation&aggregationPasses=0`);
    await expect(page.getByTestId('market-error')).toContainText(
      'aggregationPasses',
    );
  });
}

test('real workers are terminated on obsolete jobs and route cleanup', async ({
  page,
}) => {
  // Keep native workers and hold job dispatch so cancellation never depends on CPU speed.
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    const events: string[] = [];
    const queued: (() => void)[] = [];
    Object.defineProperty(window, '__workerEvents', { value: events });
    Object.defineProperty(window, '__releaseJobs', {
      value: () => queued.splice(0).forEach((send) => send()),
    });
    window.Worker = class extends NativeWorker {
      private stopped = false;
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        events.push('created');
      }
      postMessage(message: unknown) {
        queued.push(() => {
          if (!this.stopped) super.postMessage(message);
        });
      }
      terminate() {
        this.stopped = true;
        events.push('terminated');
        super.terminate();
      }
    };
  });
  const read = () =>
    page.evaluate(
      () => (window as unknown as { __workerEvents: string[] }).__workerEvents,
    );
  await page.goto('/optimized?scenario=worker-aggregation&count=60');
  await expect
    .poll(
      async () => (await read()).filter((event) => event === 'created').length,
    )
    .toBe(1);
  await page.getByTestId('market-search').fill('market 6');
  await expect
    .poll(async () =>
      Number(
        await page
          .getByTestId('aggregation-experiment')
          .getAttribute('data-cancelled-count'),
      ),
    )
    .toBe(1);
  await expect
    .poll(
      async () => (await read()).filter((event) => event === 'created').length,
    )
    .toBe(2);
  await expect(page.getByTestId('aggregation-running')).toBeVisible();
  // Client navigation exercises React cleanup, without disposing the browser context.
  await page.getByRole('link', { name: 'Case Study', exact: true }).click();
  await expect
    .poll(async () => {
      const events = await read();
      return (
        events.filter((e) => e === 'created').length -
        events.filter((e) => e === 'terminated').length
      );
    })
    .toBe(0);
  await page.evaluate(() =>
    (window as unknown as { __releaseJobs: () => void }).__releaseJobs(),
  );
  await expect(page.getByTestId('aggregation-output')).toHaveCount(0);
});
