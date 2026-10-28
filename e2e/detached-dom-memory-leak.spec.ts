import { expect, test } from '@playwright/test';
import { marketJourney } from './helpers/market-journey';
import { generateMarketRecords } from '../src/features/market/data/generate-market-records';
for (const approach of ['baseline', 'optimized']) {
  test(`${approach} actual browser drawer roots detach and retention is bounded`, async ({
    page,
  }) => {
    await page.goto(`/${approach}?scenario=detached-dom-memory-leak&count=3`);
    const journey = marketJourney(page);
    await journey.expectState('success');
    const record = generateMarketRecords({ count: 3 })[0];
    const elementCounts: number[] = [];
    for (let i = 0; i < 6; i++) {
      await journey.openDetail(record.id);
      await expect(
        page.getByTestId('detached-chart-root').locator('svg'),
      ).toBeVisible();
      elementCounts.push(
        await page
          .getByTestId('detached-chart-root')
          .evaluate((node) => 1 + node.querySelectorAll('*').length),
      );
      if (elementCounts.length > 4) elementCounts.shift();
      await journey.closeDetail(record.id);
      await expect(page.getByTestId('detached-chart-root')).toHaveCount(0);
      await page
        .getByRole('button', { name: 'Inspect retained references' })
        .click();
      const snapshot = JSON.parse(
        (await page.getByTestId('detached-dom-snapshot').textContent()) ?? '{}',
      );
      expect(snapshot.retainedRoots).toBe(
        approach === 'baseline' ? Math.min(i + 1, 4) : 0,
      );
      expect(snapshot.disconnectedRoots).toBe(snapshot.retainedRoots);
      expect(snapshot.retainedElements).toBe(
        approach === 'baseline'
          ? elementCounts.reduce((sum, count) => sum + count, 0)
          : 0,
      );
    }
    await page.getByRole('link', { name: 'Overview', exact: true }).click();
    await expect(page.getByTestId('detached-dom-diagnostics')).toHaveCount(0);
    await expect(page).toHaveURL('/');
    await page.goBack();
    await expect(page.getByTestId('detached-dom-diagnostics')).toBeVisible();
    await page
      .getByRole('button', { name: 'Inspect retained references' })
      .click();
    const restored = JSON.parse(
      (await page.getByTestId('detached-dom-snapshot').textContent()) ?? '{}',
    );
    expect(restored.retainedRoots).toBe(approach === 'baseline' ? 4 : 0);
    if (approach === 'optimized') expect(restored.recordIds).toEqual([]);
    await page
      .getByRole('button', { name: 'Reset retained references' })
      .click();
    await expect(page.getByTestId('detached-dom-snapshot')).toHaveText(
      JSON.stringify({
        retainedRoots: 0,
        disconnectedRoots: 0,
        retainedElements: 0,
        recordIds: [],
      }),
    );
  });
}
