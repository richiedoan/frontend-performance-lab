import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { marketJourney, failNextCollection } from './helpers/market-journey';
import { generateMarketRecords } from '../src/features/market/data/generate-market-records';
import { summarizeMarkets } from '../src/features/market/api/market-api';
import {
  DEFAULT_MARKET_QUERY,
  selectMarkets,
} from '../src/features/market/domain/market-query';

async function holdCollection(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    /\/api\/markets(?:\?.*)?$/,
    async (route) => {
      await gate;
      await route.continue();
    },
    { times: 1 },
  );
  return release;
}
const records = generateMarketRecords({ seed: 20260911, count: 20 });
for (const variant of ['/baseline', '/optimized'] as const) {
  for (const mobile of [false, true]) {
    test(`${variant} parity ${mobile ? 'mobile' : 'desktop'}`, async ({
      page,
    }) => {
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      const journey = marketJourney(page);
      const release = await holdCollection(page);
      await journey.open(variant, { seed: 20260911, count: 20 });
      try {
        await journey.expectState('loading');
        await expect(page.getByTestId('market-refresh')).toBeDisabled();
      } finally {
        release();
      }
      await journey.expectState('success');
      await journey.expectRows(
        selectMarkets(records, DEFAULT_MARKET_QUERY).map((r) => r.id),
      );
      const summary = summarizeMarkets(records);
      await expect(page.getByTestId('market-summary')).toContainText(
        `$${summary.averagePrice!.toFixed(2)}`,
      );
      for (const record of records) {
        const row = page
          .getByTestId('market-row')
          .filter({ has: page.getByTestId(`market-detail-${record.id}`) });
        await expect(row).toContainText(record.name);
        await expect(row).toContainText(`$${record.price.toFixed(2)}`);
        await expect(row).toContainText(record.volume.toLocaleString('en-US'));
      }
      for (const key of ['price', 'volume'] as const) {
        for (const direction of ['ascending', 'descending'] as const) {
          await journey.sort(key);
          await journey.expectRows(
            selectMarkets(records, {
              ...DEFAULT_MARKET_QUERY,
              sort: { key, direction },
            }).map((r) => r.id),
          );
          await expect(
            page.getByRole('columnheader', {
              name: key === 'price' ? 'Price' : 'Volume',
            }),
          ).toHaveAttribute('aria-sort', direction);
        }
      }
      const record = records[19];
      await journey.search('  MARKET 20  ');
      await journey.filter({
        category: record.category,
        status: record.status,
      });
      await journey.expectRows([record.id]);
      await journey.expand(record.id);
      await journey.openDetail(record.id);
      const drawer = page.getByTestId('market-drawer');
      for (const value of [
        record.name,
        record.category,
        record.status,
        `$${record.price.toFixed(2)}`,
        record.volume.toLocaleString('en-US'),
        record.updatedAt,
      ])
        await expect(drawer).toContainText(value);
      await expect(
        drawer.getByRole('img', { name: /Price history/ }),
      ).toBeVisible();
      await page.keyboard.press('Shift+Tab');
      await expect(page.getByTestId('market-close')).toBeFocused();
      await journey.closeDetail(record.id);
      const refreshRelease = await holdCollection(page);
      await journey.refresh();
      try {
        await journey.expectState('loading');
        await expect(page.getByTestId('market-summary')).toBeHidden();
      } finally {
        refreshRelease();
      }
      await journey.expectState('success');
      await journey.expectRows([record.id]);
      await expect(page.getByTestId('market-search')).toHaveValue(
        '  MARKET 20  ',
      );
      await expect(page.getByTestId('market-category')).toHaveValue(
        record.category,
      );
      await expect(page.getByTestId('market-status')).toHaveValue(
        record.status,
      );
      await expect(
        page.getByRole('columnheader', { name: 'Volume' }),
      ).toHaveAttribute('aria-sort', 'descending');
      await expect(
        page.getByTestId(`market-expand-${record.id}`),
      ).toHaveAttribute('aria-expanded', 'false');
      await journey.search('no matches');
      await journey.expectState('empty');
      await journey.search(record.name);
      await failNextCollection(page);
      await journey.refresh();
      await journey.expectState('error');
      await expect(page.getByTestId('market-error')).toHaveAttribute(
        'role',
        'alert',
      );
      await journey.retry();
      await journey.expectState('success');
      await journey.expectRows([record.id]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  }
}
