import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { marketJourney } from './helpers/market-journey';
import { generateMarketRecords } from '../src/features/market/data/generate-market-records';
import {
  DEFAULT_MARKET_QUERY,
  selectMarkets,
} from '../src/features/market/domain/market-query';
async function counters(page: Page) {
  return page.getByTestId('search-diagnostics').evaluate((element) => ({
    requests: Number(element.getAttribute('data-request-count')),
    calculations: Number(element.getAttribute('data-calculation-count')),
    aborted: Number(element.getAttribute('data-aborted-count')),
    stale: Number(element.getAttribute('data-stale-count')),
  }));
}
async function open(page: Page, route: string) {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto(`${route}?scenario=search-input&seed=20260911&count=40`);
  await expect(page.getByTestId('market-summary')).toBeVisible();
  await page.clock.runFor(700);
  await marketJourney(page).expectState('success');
}
for (const route of ['/baseline', '/optimized'] as const) {
  test(`${route} isolated rapid typing reaches the same final result`, async ({
    page,
  }) => {
    await open(page, route);
    const initial = await counters(page);
    const input = page.getByTestId('market-search');
    await input.pressSequentially('market 4');
    // A paused browser clock makes the rapid typing window reproducible.
    await expect
      .poll(async () => (await counters(page)).requests - initial.requests)
      .toBe(route === '/baseline' ? 8 : 0);
    await page.clock.runFor(650);
    const expected = selectMarkets(
      generateMarketRecords({ seed: 20260911, count: 40 }),
      { ...DEFAULT_MARKET_QUERY, search: 'market 4' },
    );
    await marketJourney(page).expectRows(expected.map((record) => record.id));
    const final = await counters(page);
    expect(final.requests - initial.requests).toBe(
      route === '/baseline' ? 8 : 1,
    );
    expect(final.calculations).toBe(final.requests * 12);
    expect(final.aborted).toBe(0);
    const completions = JSON.parse(
      (await page.getByTestId('search-completions').textContent()) ?? '[]',
    );
    for (const event of completions)
      expect(event.completedAt).toBeGreaterThanOrEqual(event.startedAt);
    await expect(page.getByTestId('market-virtual-scroll')).toHaveCount(0);
    const filters = {
      category: expected[0].category,
      status: expected[0].status,
    };
    await marketJourney(page).filter(filters);
    await page.clock.runFor(310);
    await marketJourney(page).sort('volume');
    await page.clock.runFor(310);
    await marketJourney(page).expectRows(
      selectMarkets(generateMarketRecords({ seed: 20260911, count: 40 }), {
        search: 'market 4',
        filters,
        sort: { key: 'volume', direction: 'ascending' },
      }).map((record) => record.id),
    );
    await marketJourney(page).openDetail(expected[0].id);
    await marketJourney(page).closeDetail(expected[0].id);
  });
  test(`${route} obsolete requests cannot replace the newest query`, async ({
    page,
  }) => {
    await open(page, route);
    const initial = await counters(page);
    await page.getByTestId('market-search').fill('m');
    await page.clock.runFor(250); // optimized request is now in flight, with 400ms delivery.
    await page.getByTestId('market-search').fill('no matches');
    await page.clock.runFor(0);
    const changed = await counters(page);
    expect(changed.aborted - initial.aborted).toBe(
      route === '/optimized' ? 1 : 0,
    );
    await page.clock.runFor(310);
    await marketJourney(page).expectState('empty');
    await page.clock.runFor(500); // includes the old request's original completion deadline.
    await marketJourney(page).expectState('empty');
    const final = await counters(page);
    expect(final.stale - initial.stale).toBe(route === '/baseline' ? 1 : 0);
    await page.getByTestId('market-search').fill('market 4');
    await page.clock.runFor(310);
    await marketJourney(page).expectState('success');
    await marketJourney(page).refresh();
    await expect(page.getByTestId('market-summary')).toBeVisible();
    await page.clock.runFor(310);
    await marketJourney(page).expectState('success');
    await expect(page.getByTestId('market-search')).toHaveValue('market 4');
  });
}
