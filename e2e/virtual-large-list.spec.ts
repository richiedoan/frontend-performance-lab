import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { generateMarketRecords } from '../src/features/market/data/generate-market-records';
import {
  DEFAULT_MARKET_QUERY,
  selectMarkets,
} from '../src/features/market/domain/market-query';
import { marketJourney, failNextCollection } from './helpers/market-journey';

async function expectWindowBound(page: Page) {
  await expect
    .poll(() => page.getByTestId('market-row').count())
    .toBeLessThanOrEqual(16);
  // Bound all table rows as well as primary records, including expansion and spacer rows.
  expect(
    await page.getByTestId('market-table').locator('tr').count(),
  ).toBeLessThanOrEqual(36);
}
async function expectOrder(page: Page, route: string, expected: string[]) {
  if (route === '/baseline') return marketJourney(page).expectRows(expected);
  await expect(page.getByTestId(`market-detail-${expected[0]}`)).toBeAttached();
  await page.getByTestId(`market-detail-${expected[0]}`).focus();
  for (let index = 0; index < expected.length; index++) {
    const button = page.getByTestId(`market-detail-${expected[index]}`);
    await expect(button).toBeFocused();
    await expect(button.locator('xpath=ancestor::tr')).toHaveAttribute(
      'aria-rowindex',
      String(index + 2),
    );
    if (index + 1 < expected.length) await button.press('ArrowDown');
  }
  await expectWindowBound(page);
}
for (const route of ['/baseline', '/optimized'] as const) {
  for (const mobile of [false, true]) {
    test(`${route} large-list parity ${mobile ? 'mobile' : 'desktop'}`, async ({
      page,
    }) => {
      test.setTimeout(60_000);
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      const records = generateMarketRecords({ count: 24, seed: 20260911 });
      const journey = marketJourney(page);
      await page.goto(`${route}?scenario=large-list&count=24&seed=20260911`);
      await journey.expectState('success');
      await expectOrder(
        page,
        route,
        selectMarkets(records, DEFAULT_MARKET_QUERY).map((r) => r.id),
      );
      const summary = await page.getByTestId('market-summary').innerText();
      for (const key of ['price', 'volume'] as const)
        for (const direction of ['ascending', 'descending'] as const) {
          await journey.sort(key);
          await expectOrder(
            page,
            route,
            selectMarkets(records, {
              ...DEFAULT_MARKET_QUERY,
              sort: { key, direction },
            }).map((r) => r.id),
          );
        }
      const target = records[23];
      await journey.search(`  ${target.name.toUpperCase()}  `);
      await journey.filter({
        category: target.category,
        status: target.status,
      });
      await journey.expectRows([target.id]);
      await expect(page.getByTestId('market-summary')).toHaveText(summary, {
        useInnerText: true,
      });
      await journey.expand(target.id);
      await journey.openDetail(target.id);
      for (const value of [
        target.name,
        target.category,
        target.status,
        `$${target.price.toFixed(2)}`,
        target.volume.toLocaleString('en-US'),
        target.updatedAt,
      ])
        await expect(page.getByTestId('market-drawer')).toContainText(value);
      await expect(
        page
          .getByTestId('market-drawer')
          .getByRole('img', { name: /Price history/ }),
      ).toBeVisible();
      await journey.closeDetail(target.id);
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route(
        /\/api\/markets(?:\?.*)?$/,
        async (request) => {
          await gate;
          await request.continue();
        },
        { times: 1 },
      );
      await journey.refresh();
      try {
        await journey.expectState('loading');
      } finally {
        release();
      }
      await journey.expectRows([target.id]);
      await expect(
        page.getByTestId(`market-expand-${target.id}`),
      ).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByTestId('market-category')).toHaveValue(
        target.category,
      );
      await expect(page.getByTestId('market-status')).toHaveValue(
        target.status,
      );
      await expect(
        page.getByRole('columnheader', { name: 'Volume' }),
      ).toHaveAttribute('aria-sort', 'descending');
      await journey.search('missing market');
      await journey.expectState('empty');
      await journey.search(target.name);
      await failNextCollection(page);
      await journey.refresh();
      await journey.expectState('error');
      await journey.retry();
      await journey.expectRows([target.id]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  }
}

test('optimized 5,000 records: bounded scrolling, keyboard traversal, expansion and drawer focus', async ({
  page,
}) => {
  const records = selectMarkets(
    generateMarketRecords({ seed: 20260911, count: 5000 }),
    DEFAULT_MARKET_QUERY,
  );
  await page.goto('/optimized?scenario=large-list');
  const journey = marketJourney(page);
  await journey.expectState('success');
  await expect(page.getByTestId('market-table')).toHaveAttribute(
    'aria-rowcount',
    '5001',
  );
  await expectWindowBound(page);
  const first = page.getByTestId(`market-detail-${records[0].id}`);
  await first.focus();
  // Tab crosses a virtual window boundary without skipping a logical record.
  for (let index = 1; index <= 12; index++) {
    await page.keyboard.press('Tab');
    await expect(
      page.getByTestId(`market-expand-${records[index].id}`),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      page.getByTestId(`market-detail-${records[index].id}`),
    ).toBeFocused();
  }
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(
    page.getByTestId(`market-detail-${records[11].id}`),
  ).toBeFocused();
  await page.keyboard.press('End');
  const last = records[4999];
  await expect(page.getByTestId(`market-detail-${last.id}`)).toBeFocused();
  await expect(page.getByTestId(`market-detail-${last.id}`)).toBeInViewport();
  await journey.expand(last.id);
  await expect(page.getByTestId('market-table')).toHaveAttribute(
    'aria-rowcount',
    '5002',
  );
  await journey.openDetail(last.id);
  // Restore the opener after scrolling unmounts it while the drawer is open.
  await page.getByTestId('market-virtual-scroll').evaluate((el) => {
    el.scrollTop = 0;
  });
  await journey.closeDetail(last.id);
  await expectWindowBound(page);
  await page.keyboard.press('Home');
  await expect(first).toBeFocused();
  // Native scrolling reaches the final record without mounting the full dataset.
  const scroller = page.getByTestId('market-virtual-scroll');
  await scroller.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(page.getByTestId(`market-detail-${last.id}`)).toBeInViewport();
  await expectWindowBound(page);
  await expect(first).toHaveCount(0);
  await expect(scroller).toBeFocused();
  await expect(scroller).toHaveCSS('outline-style', 'solid');
  await expect(page.getByTestId(`market-expanded-${last.id}`)).toBeVisible();
  await scroller.press('End');
  await expect(page.getByTestId(`market-expand-${last.id}`)).toBeFocused();
  await journey.search(last.name);
  await journey.expectRows([last.id]);
  await journey.openDetail(last.id);
  await journey.closeDetail(last.id);
});
