import { expect, test } from '@playwright/test';

test('page entry animates on initial load and navigation without blocking links', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      if (this.classList.contains('lab-content')) {
        document.documentElement.dataset.pageAnimations = String(
          Number(document.documentElement.dataset.pageAnimations ?? 0) + 1,
        );
      }
      return animate.apply(this, args);
    };
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute(
    'data-page-animations',
    '1',
  );
  const link = page
    .getByRole('navigation', { name: 'Explore lab' })
    .getByRole('link', { name: 'Case Study' });
  await link.focus();
  await link.press('Enter');
  await expect(page).toHaveURL('/case-study');
  await expect(page.getByRole('heading', { name: 'Case Study' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute(
    'data-page-animations',
    '2',
  );
});

test('reduced motion disables page and control animation while navigation still works', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/baseline?count=2');
  const button = page.getByTestId('market-refresh');
  await expect(button).toBeEnabled();
  await button.hover();
  expect(
    await button.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    ),
  ).toBe('0s');
  expect(
    await button.evaluate((element) => getComputedStyle(element).translate),
  ).toBe('none');
  expect(
    await page
      .locator('.lab-content')
      .evaluate((element) => element.getAnimations().length),
  ).toBe(0);
  await page
    .getByRole('navigation', { name: 'Explore lab' })
    .getByRole('link', { name: 'Case Study' })
    .click();
  await expect(page.getByRole('heading', { name: 'Case Study' })).toBeVisible();
});
