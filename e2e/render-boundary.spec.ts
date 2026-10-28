import { expect, test } from '@playwright/test';
import { marketJourney } from './helpers/market-journey';
import { generateMarketRecords } from '../src/features/market/data/generate-market-records';
import {
  DEFAULT_MARKET_QUERY,
  selectMarkets,
} from '../src/features/market/domain/market-query';

for (const route of ['/baseline', '/optimized'] as const) {
  test(`${route} render-boundary output and interactions match without production counters`, async ({
    page,
  }) => {
    if (route === '/optimized')
      await page.setViewportSize({ width: 390, height: 844 });
    const journey = marketJourney(page);
    const records = generateMarketRecords({ seed: 20260911, count: 20 });
    await page.goto(`${route}?scenario=render-boundary&seed=20260911&count=20`);
    await journey.expectRows(
      selectMarkets(records, DEFAULT_MARKET_QUERY).map((record) => record.id),
    );
    const summary = await page.getByTestId('market-summary').textContent();
    await page
      .getByTestId('boundary-note')
      .pressSequentially('comparison note');
    await expect(page.getByTestId('boundary-note')).toHaveValue(
      'comparison note',
    );
    await expect(page.getByTestId('market-summary')).toHaveText(summary!);
    await page.getByRole('button', { name: 'Explain summary' }).press('Enter');
    await expect(
      page.getByText('Summary reflects the complete dataset.'),
    ).toBeVisible();
    await expect(page.getByTestId('summary-render-commits')).toHaveCount(0);
    for (const id of [
      'search-diagnostics',
      'aggregation-experiment',
      'market-virtual-scroll',
    ])
      await expect(page.getByTestId(id)).toHaveCount(0);
    const record = records[19];
    await journey.search(record.name);
    await journey.filter({ category: record.category, status: record.status });
    await journey.sort('price');
    await journey.expectRows([record.id]);
    await expect(page.getByTestId('market-summary')).toHaveText(summary!);
    await expect(page.getByTestId('boundary-note')).toHaveValue(
      'comparison note',
    );
    await journey.expand(record.id);
    await journey.openDetail(record.id);
    await journey.closeDetail(record.id);
    await journey.refresh();
    await journey.expectRows([record.id]);
    await expect(page.getByTestId('boundary-note')).toHaveValue('');
    await expect(
      page.getByText('Summary reflects the complete dataset.'),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.goto(`${route}?scenario=default&count=3`);
    await journey.expectState('success');
    await expect(page.getByTestId('render-boundary-experiment')).toHaveCount(0);
  });
}
