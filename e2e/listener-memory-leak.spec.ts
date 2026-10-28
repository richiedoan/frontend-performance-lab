import { expect, test } from '@playwright/test';
for (const approach of ['baseline', 'optimized'] as const) {
  test(`${approach} SPA unmounts retain only deliberate listeners and reset removes them`, async ({
    page,
  }) => {
    await page.goto(`/${approach}?scenario=listener-memory-leak&count=3`);
    for (let cycle = 0; cycle < 3; cycle++) {
      await expect(page.getByTestId('listener-experiment')).toBeVisible();
      await page.getByRole('link', { name: 'Overview', exact: true }).click();
      await expect(page.getByTestId('listener-experiment')).toHaveCount(0);
      if (cycle < 2) await page.goBack();
    }
    const dispatched = await page.evaluate((name) => {
      window.dispatchEvent(
        new CustomEvent(`market-lab:listener-probe:${name}`),
      );
      return performance
        .getEntriesByType('mark')
        .filter((entry) => entry.name.startsWith('listener-memory:'))
        .map((entry) => (entry as PerformanceMark).detail)
        .filter((sample) => sample.phase === 'dispatch');
    }, approach);
    expect(dispatched).toHaveLength(approach === 'baseline' ? 3 : 0);
    for (const sample of dispatched)
      expect(sample).toMatchObject({ mounted: false, records: 3 });
    const afterReset = await page.evaluate((name) => {
      window.dispatchEvent(
        new CustomEvent(`market-lab:listener-probe:${name}`, {
          detail: { reset: true },
        }),
      );
      const before = performance
        .getEntriesByType('mark')
        .filter((entry) => entry.name.startsWith('listener-memory:')).length;
      window.dispatchEvent(
        new CustomEvent(`market-lab:listener-probe:${name}`),
      );
      return (
        performance
          .getEntriesByType('mark')
          .filter((entry) => entry.name.startsWith('listener-memory:')).length -
        before
      );
    }, approach);
    expect(afterReset).toBe(0);
  });
}
