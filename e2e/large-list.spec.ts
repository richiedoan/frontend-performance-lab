import { expect, test } from '@playwright/test';
import { generateMarketRecords } from '../src/features/market/data/generate-market-records';
import {
  DEFAULT_MARKET_QUERY,
  selectMarkets,
} from '../src/features/market/domain/market-query';
import { inspectBaselineList } from './helpers/large-list-dom';
import { failNextCollection, marketJourney } from './helpers/market-journey';

test('baseline large-list mounts all 5,000 default records before scrolling', async ({
  page,
}) => {
  // Full DOM correctness, not a performance threshold.
  test.setTimeout(90_000);
  await page.goto('/baseline?scenario=large-list');
  await expect(page.getByTestId('market-row')).toHaveCount(5000, {
    timeout: 60_000,
  });
  const snapshot = await inspectBaselineList(page);
  const expected = selectMarkets(
    generateMarketRecords({ seed: 20260911, count: 5000 }),
    DEFAULT_MARKET_QUERY,
  );
  expect(snapshot.ids).toEqual(expected.map((record) => record.id));
  expect(snapshot.configuredCount).toBe(5000);
  expect(snapshot.seed).toBe(20260911);
  expect(snapshot.renderedRows).toBe(5000);
  expect(snapshot.tableDomNodes).toBeGreaterThan(snapshot.renderedRows);
  expect(snapshot.scopeDomNodes).toBeGreaterThan(snapshot.tableDomNodes);
  // The last offscreen record is already mounted and keyboard-operable.
  const last = expected[expected.length - 1];
  const journey = marketJourney(page);
  await journey.expand(last.id);
  await journey.openDetail(last.id);
  await journey.closeDetail(last.id);
  expect((await inspectBaselineList(page)).ids).toEqual(snapshot.ids);
});

test('baseline large-list configured dataset retains the complete interaction contract', async ({
  page,
}) => {
  const records = generateMarketRecords({ seed: 20260911, count: 80 });
  const journey = marketJourney(page);
  await page.goto('/baseline?scenario=large-list&seed=20260911&count=80');
  await journey.expectRows(
    selectMarkets(records, DEFAULT_MARKET_QUERY).map((record) => record.id),
  );
  expect((await inspectBaselineList(page)).renderedRows).toBe(80);
  for (const key of ['price', 'volume'] as const) {
    for (const direction of ['ascending', 'descending'] as const) {
      await journey.sort(key);
      await journey.expectRows(
        selectMarkets(records, {
          ...DEFAULT_MARKET_QUERY,
          sort: { key, direction },
        }).map((record) => record.id),
      );
    }
  }
  const target = records[79];
  await journey.search(`  ${target.name.toUpperCase()}  `);
  await journey.filter({ category: target.category, status: target.status });
  await journey.expectRows([target.id]);
  await journey.expand(target.id);
  await journey.openDetail(target.id);
  await expect(page.getByTestId('market-drawer')).toContainText(target.name);
  await journey.closeDetail(target.id);
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
  await journey.refresh();
  try {
    await journey.expectState('loading');
    expect((await inspectBaselineList(page)).renderedRows).toBe(0);
  } finally {
    release();
  }
  await journey.expectRows([target.id]);
  await expect(page.getByTestId(`market-expand-${target.id}`)).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(
    page.getByRole('columnheader', { name: 'Volume' }),
  ).toHaveAttribute('aria-sort', 'descending');
  await expect(page.getByTestId('market-category')).toHaveValue(
    target.category,
  );
  await expect(page.getByTestId('market-status')).toHaveValue(target.status);
  await journey.search('no matching market');
  await journey.expectState('empty');
  expect((await inspectBaselineList(page)).renderedRows).toBe(0);
  await journey.search(target.name);
  await failNextCollection(page);
  await journey.refresh();
  await journey.expectState('error');
  expect((await inspectBaselineList(page)).renderedRows).toBe(0);
  await journey.retry();
  await journey.expectRows([target.id]);
  await journey.search('');
  await journey.filter({ category: 'all', status: 'all' });
  await journey.expectRows(
    selectMarkets(records, {
      ...DEFAULT_MARKET_QUERY,
      sort: { key: 'volume', direction: 'descending' },
    }).map((record) => record.id),
  );
});

test('baseline large-list accepts an explicitly empty dataset', async ({
  page,
}) => {
  await page.goto('/baseline?scenario=large-list&count=0');
  await marketJourney(page).expectState('empty');
  expect(await inspectBaselineList(page)).toMatchObject({
    configuredCount: 0,
    renderedRows: 0,
    tableDomNodes: 0,
  });
});
