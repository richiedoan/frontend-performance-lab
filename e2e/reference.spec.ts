import { expect, test } from '@playwright/test';
import { marketJourney, failNextCollection } from './helpers/market-journey';
import { generateMarketRecords } from '../src/features/market/data/generate-market-records';
import {
  DEFAULT_MARKET_QUERY,
  selectMarkets,
} from '../src/features/market/domain/market-query';

for (const mobile of [false, true]) {
  test(`reference complete journey (${mobile ? 'mobile' : 'desktop'})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const journey = marketJourney(page);
    await journey.open('/reference', { seed: 42, count: 20, delayMs: 100 });
    await journey.expectState('success');
    const records = generateMarketRecords({ seed: 42, count: 20 });
    await journey.expectRows(
      selectMarkets(records, DEFAULT_MARKET_QUERY).map((r) => r.id),
    );
    const record = records[0];
    await journey.search(record.name);
    await journey.filter({ category: record.category, status: record.status });
    await journey.sort('price');
    await journey.expectRows([record.id]);
    await journey.expand(record.id);
    await journey.openDetail(record.id);
    await expect(
      page.getByRole('img', { name: /Price history/ }),
    ).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('market-close')).toBeFocused();
    await journey.closeDetail(record.id);
    await journey.openDetail(record.id);
    await journey.closeDetail(record.id, 'button');
    await journey.refresh();
    await journey.expectState('success');
    await journey.expectRows([record.id]);
    await expect(page.getByTestId('market-search')).toHaveValue(record.name);
    await expect(
      page.getByTestId(`market-expand-${record.id}`),
    ).toHaveAttribute('aria-expanded', 'false');
    await journey.search('unmatched search');
    await journey.expectState('empty');
    await journey.search(record.name);
    await failNextCollection(page);
    await journey.refresh();
    await journey.expectState('error');
    await journey.retry();
    await journey.expectState('success');
    await journey.expectRows([record.id]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

test('empty dataset and invalid configuration', async ({ page }) => {
  const journey = marketJourney(page);
  await journey.open('/reference', { count: 0 });
  await journey.expectState('empty');
  await page.goto('/reference?count=-1');
  await journey.expectState('error');
  await expect(page.getByTestId('market-error')).toContainText('400');
});
