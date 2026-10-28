import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MARKET_SELECTORS as ids } from '../../src/features/market/components/market-selectors';
import type {
  MarketFiltersValue,
  MarketSortKey,
} from '../../src/features/market/domain/market-query';

export type MarketVariant = '/baseline' | '/optimized';

/** Journeys target the dashboard contract; placeholder routes do not satisfy it yet. */
export function marketJourney(page: Page) {
  const byId = (id: string) => page.getByTestId(id);
  return {
    async open(
      variant: MarketVariant | '/reference',
      options: { seed?: number; count?: number; delayMs?: number } = {},
    ) {
      const params = new URLSearchParams({
        seed: String(options.seed ?? 20260911),
        count: String(options.count ?? 20),
        delayMs: String(options.delayMs ?? 0),
      });
      await page.goto(`${variant}?${params}`);
      await expect(byId(ids.dashboard)).toBeVisible();
    },
    async search(value: string) {
      await byId(ids.search).fill(value);
    },
    async filter(value: MarketFiltersValue) {
      await byId(ids.category).selectOption(value.category);
      await byId(ids.status).selectOption(value.status);
    },
    async sort(key: MarketSortKey) {
      await byId(ids.sort(key)).click();
    },
    async expectRows(expectedIds: readonly string[]) {
      // Use for bounded fixtures, not future virtualized full-dataset DOM counts.
      await expect
        .poll(async () =>
          byId(ids.row).evaluateAll((rows) =>
            rows.map((row) => row.getAttribute('data-market-id')),
          ),
        )
        .toEqual([...expectedIds]);
    },
    async expand(id: string, expanded = true) {
      const button = byId(ids.expand(id));
      if ((await button.getAttribute('aria-expanded')) !== String(expanded))
        await button.press('Enter');
      await expect(button).toHaveAttribute('aria-expanded', String(expanded));
      if (expanded) await expect(byId(ids.expanded(id))).toBeVisible();
      else await expect(byId(ids.expanded(id))).toBeHidden();
    },
    async openDetail(id: string) {
      await byId(ids.detail(id)).press('Enter');
      await expect(byId(ids.drawer)).toBeVisible();
      await expect(byId(ids.close)).toBeFocused();
    },
    async closeDetail(id: string, method: 'escape' | 'button' = 'escape') {
      if (method === 'escape') await page.keyboard.press('Escape');
      else await byId(ids.close).click();
      await expect(byId(ids.drawer)).toBeHidden();
      await expect(byId(ids.detail(id))).toBeFocused();
    },
    async refresh() {
      await byId(ids.refresh).click();
    },
    async retry() {
      await byId(ids.retry).click();
    },
    async expectState(state: 'loading' | 'empty' | 'error' | 'success') {
      const active = state === 'success' ? ids.table : ids[state];
      await expect(byId(active)).toBeVisible();
      for (const selector of [ids.table, ids.loading, ids.empty, ids.error]) {
        if (selector !== active) await expect(byId(selector)).toBeHidden();
      }
    },
  };
}

/** Fail one collection load, then release subsequent requests to the real mock API. */
export async function failNextCollection(page: Page) {
  await page.route(
    /\/api\/markets(?:\?.*)?$/,
    (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'SIMULATED_ERROR',
            message: 'Simulated market API failure',
          },
        }),
      }),
    { times: 1 },
  );
}
