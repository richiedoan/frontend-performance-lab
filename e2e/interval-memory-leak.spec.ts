import { expect, test } from '@playwright/test';
for (const route of ['/baseline', '/optimized']) {
  test(`${route} interval work after SPA navigation is bounded and observable`, async ({
    page,
  }) => {
    await page.goto(`${route}?scenario=interval-memory-leak&count=3`);
    await expect(page.getByTestId('interval-experiment')).toBeVisible();
    await expect(page.getByTestId('interval-experiment')).toHaveAttribute(
      'data-tick',
      /^[1-9]/,
    );
    const session = Number(
      await page
        .getByTestId('interval-experiment')
        .getAttribute('data-session'),
    );
    await page.getByRole('link', { name: 'Overview', exact: true }).click();
    await expect(page.getByTestId('interval-experiment')).toHaveCount(0);
    const readEvents = () =>
      page.evaluate(() =>
        performance
          .getEntriesByType('mark')
          .filter((entry) => entry.name.startsWith('interval-memory:'))
          .map((entry) => (entry as PerformanceMark).detail),
      );
    if (route === '/baseline') {
      await expect
        .poll(async () =>
          (await readEvents()).some(
            (event) =>
              event.session === session &&
              event.phase === 'tick' &&
              !event.mounted,
          ),
        )
        .toBe(true);
    } else {
      const events = await readEvents();
      expect(
        events.some(
          (event) =>
            event.session === session &&
            event.phase === 'tick' &&
            !event.mounted,
        ),
      ).toBe(false);
      expect(
        events.some(
          (event) => event.session === session && event.phase === 'stop',
        ),
      ).toBe(true);
    }
    await expect
      .poll(async () => (await readEvents()).at(-1), { timeout: 25000 })
      .toMatchObject({ phase: 'stop', active: 0, records: 0 });
  });
}
