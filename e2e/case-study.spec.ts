import { test, expect } from '@playwright/test';
import { summarizeCaseStudy } from '../src/experiments/data/summaries/case-study';
import { readCaseStudyRun } from '../src/experiments/data/catalog/case-study-records';
import { measuredFixture } from '../src/experiments/data/validation/fixtures/evidence-fixture';
import { plannedDefinitions } from '../src/experiments/data/definitions/planned';
// Transport fixtures only: never registered or written into public evidence.
for (const mode of ['populated', 'partial', 'unavailable'] as const) {
  test(`case study ${mode} data on mobile`, async ({ page }) => {
    const definition = plannedDefinitions[0];
    const run = measuredFixture('fixture-browser', 'a'.repeat(64));
    const baseline = run.results[0].result;
    if (mode === 'populated' && baseline.status === 'measured')
      run.results[1].result = { ...baseline, value: 5 };
    const records = summarizeCaseStudy([
      {
        definition,
        runs: [readCaseStudyRun(run, definition, () => mode !== 'unavailable')],
      },
    ]);
    await page.route('**/api/case-study', (route) =>
      route.fulfill({ json: { records } }),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/case-study');
    await expect(
      page.getByRole('heading', { name: 'Case Study', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    if (mode === 'populated') {
      await expect(page.getByText('50.00% lower than baseline.')).toBeVisible();
      await expect(
        page.getByRole('figure', { name: 'Runtime — lab: dom-nodes' }),
      ).toBeVisible();
      await expect(page.getByRole('link', { name: /^Evidence:/ })).toHaveCount(
        2,
      );
    } else {
      await expect(page.getByRole('figure')).toHaveCount(0);
      await expect(page.getByText(/Comparison unavailable/)).toBeVisible();
      await expect(page.getByRole('link', { name: /^Evidence:/ })).toHaveCount(
        mode === 'partial' ? 1 : 0,
      );
    }
    await page.getByText('Environment and provenance', { exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByText('test-only-revision', { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByText(/Field interaction data is not available/),
    ).toBeVisible();
  });
}
test('real registry stays unavailable and failed loading can retry', async ({
  page,
}) => {
  await page.route(
    '**/api/case-study',
    (route) =>
      route.fulfill({ status: 500, json: { error: 'fixture failure' } }),
    { times: 1 },
  );
  await page.goto('/case-study');
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(
    page.getByRole('heading', { name: 'Large list', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('figure')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^Evidence:/ })).toHaveCount(0);
});

for (const count of [2, 1, 0]) {
  test(`journey duration with ${count} eligible approaches`, async ({
    page,
  }) => {
    const definition = {
      ...plannedDefinitions[0],
      metrics: [{ id: 'journey-duration', unit: 'ms' as const }],
    };
    const run = measuredFixture('journey-browser-fixture', 'a'.repeat(64));
    const measured = run.results[0].result;
    if (measured.status !== 'measured') throw new Error('Fixture');
    run.results = (['baseline', 'optimized'] as const).map(
      (approach, index) => ({
        approach,
        metricId: 'journey-duration',
        result:
          index < count
            ? {
                ...measured,
                unit: 'ms',
                value: index ? 5 : 10,
                extraction:
                  'journey/median-v1; readiness dataset-then-table-v1',
              }
            : {
                status: 'not-available',
                reason: 'Requires five successful samples; 4/5 valid.',
              },
      }),
    );
    const records = summarizeCaseStudy([
      { definition, runs: [readCaseStudyRun(run, definition, () => true)] },
    ]);
    await page.route('**/api/case-study', (route) =>
      route.fulfill({ json: { records } }),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/case-study');
    await expect(
      page.getByRole('heading', { name: 'Journey duration' }),
    ).toBeVisible();
    await expect(page.getByText(/This is not INP, LCP/)).toBeVisible();
    await expect(page.getByRole('link', { name: /^Evidence:/ })).toHaveCount(
      count,
    );
    await expect(page.getByText(/Median · 5 samples/)).toHaveCount(count);
    if (count === 2)
      await expect(page.getByText('50.00% lower than baseline.')).toBeVisible();
    else {
      await expect(page.getByRole('figure')).toHaveCount(0);
      await expect(page.getByText(/Comparison unavailable/)).toBeVisible();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
