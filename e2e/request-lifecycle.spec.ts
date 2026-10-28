import { expect, test } from '@playwright/test';
import { generateMarketRecords } from '../src/features/market/data/generate-market-records';
for (const route of ['/baseline', '/optimized']) {
  test(`${route} finite request race converges with lifecycle evidence`, async ({
    page,
  }) => {
    await page.clock.install();
    await page.goto(
      `${route}?scenario=request-lifecycle&seed=20260911&count=3`,
    );
    const panel = page.getByTestId('request-lifecycle');
    await expect(panel).toBeVisible();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.getByRole('button', { name: 'Run request race' }).click();
    await page.clock.runFor(50);
    const records = generateMarketRecords({ seed: 20260911, count: 3 });
    await expect(page.getByTestId('lifecycle-result')).toHaveText(
      records[2].name,
    );
    await page.clock.runFor(250);
    await expect(page.getByTestId('lifecycle-result')).toHaveText(
      route === '/baseline' ? records[0].name : records[2].name,
    );
    await page.clock.runFor(50);
    await expect(panel).toHaveAttribute('data-status', 'success');
    await expect(page.getByTestId('lifecycle-result')).toHaveText(
      records[2].name,
    );
    const events = JSON.parse(
      (await page.getByTestId('lifecycle-events').textContent()) ?? '[]',
    ) as { type: string; version: number }[];
    expect(events.filter((e) => e.type === 'start')).toHaveLength(
      route === '/baseline' ? 5 : 2,
    );
    expect(events.some((e) => e.type === 'apply' && e.version === 1)).toBe(
      route === '/baseline',
    );
    await page.getByRole('button', { name: 'Run request race' }).click();
    await page.clock.runFor(350);
    await expect(panel).toHaveAttribute('data-status', 'success');
    if (route === '/optimized')
      await expect(page.getByTestId('lifecycle-events')).toContainText(
        'cache-hit',
      );
    await page.goto(`${route}?count=3`);
    await expect(panel).toHaveCount(0);
  });
}
