import { expect, test } from '@playwright/test';
import { SCENARIOS } from '../src/features/market/config/scenario-config';
import { generateMarketRecords } from '../src/features/market/data/generate-market-records';
import {
  DEFAULT_MARKET_QUERY,
  selectMarkets,
} from '../src/features/market/domain/market-query';
import { marketJourney } from './helpers/market-journey';

for (const route of ['/baseline', '/optimized'] as const) {
  test(`${route} deterministic scenario selection`, async ({ page }) => {
    const queries: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/markets'))
        queries.push(new URL(request.url()).search);
    });
    for (const scenario of SCENARIOS) {
      await page.goto(`${route}?scenario=${scenario}&seed=20260911&count=3`);
      await marketJourney(page).expectState('success');
      await expect(page.getByTestId('scenario-config')).toHaveAttribute(
        'data-scenario',
        scenario,
      );
      await marketJourney(page).expectRows(
        selectMarkets(
          generateMarketRecords({ seed: 20260911, count: 3 }),
          DEFAULT_MARKET_QUERY,
        ).map((r) => r.id),
      );
      await expect(page.getByTestId('scenario-indicator')).toHaveCount(0);
    }
    expect(queries.length).toBeGreaterThanOrEqual(SCENARIOS.length * 2);
    for (const query of queries) {
      const params = new URLSearchParams(query);
      expect(params.has('scenario')).toBe(false);
      expect(params.get('seed')).toBe('20260911');
      expect(params.get('count')).toBe('3');
    }
  });
  test(`${route} invalid configuration makes no API calls and can reset`, async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/markets'))
        requests.push(request.url());
    });
    for (const query of [
      'scenario=wrong',
      'count=10001',
      'seed=NaN',
      'scenario=default&scenario=large-list',
    ]) {
      await page.goto(`${route}?${query}`);
      await expect(page.getByTestId('market-error')).toContainText(
        'Invalid configuration',
      );
      await expect(page.getByTestId('market-table')).toHaveCount(0);
    }
    expect(requests).toEqual([]);
    // Keep the real default API requests, but filter before they complete so
    // reset correctness does not also stress-render 5,000 nonvirtualized rows.
    // Full-list DOM coverage lives in large-list.spec.ts.
    const records = generateMarketRecords({ seed: 20260911, count: 5000 });
    const target = records[records.length - 1];
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
    const journey = marketJourney(page);
    try {
      await page.getByRole('link', { name: 'Reset configuration' }).click();
      await expect(page).toHaveURL(route);
      await journey.expectState('loading');
      await expect(page.getByTestId('market-search')).toHaveValue('');
      await journey.search(target.name);
    } finally {
      release();
    }
    await expect(page.getByTestId('scenario-config')).toHaveAttribute(
      'data-scenario',
      'default',
    );
    await expect(page.getByTestId('market-table')).toBeVisible({
      timeout: 30_000,
    });
    await journey.expectState('success');
    await journey.expectRows([target.id]);
    await expect(page.getByTestId('market-summary')).toContainText('5,000');
    expect(requests.map((request) => new URL(request).pathname).sort()).toEqual(
      ['/api/markets', '/api/markets/summary'],
    );
    for (const request of requests) {
      expect(new URL(request).searchParams.get('count')).toBe('5000');
      expect(new URL(request).searchParams.get('seed')).toBe('20260911');
      expect(new URL(request).searchParams.get('delayMs')).toBe('0');
      expect(new URL(request).searchParams.get('simulateError')).toBe('false');
      expect(new URL(request).searchParams.has('scenario')).toBe(false);
    }
  });
}
