import { expect, test } from '@playwright/test';

for (const [path, heading] of [
  ['/baseline', 'Live Market Explorer'],
  ['/optimized', 'Live Market Explorer'],
  ['/case-study', 'Case Study'],
] as const) {
  test(`${path} renders its screen`, async ({ page }) => {
    const response = await page.goto(`${path}?count=20`);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('main').getByRole('heading', { name: heading, level: 1 }),
    ).toBeVisible();
    if (path === '/case-study')
      await expect(
        page.getByRole('navigation', { name: 'Experiments' }),
      ).toBeVisible();
    else await expect(page.getByTestId('market-table')).toBeVisible();
  });
}

test('home navigation opens a lab route', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('region', { name: 'How to use the lab' })
    .getByRole('link', { name: 'Open baseline: Default explorer', exact: true })
    .click();
  await expect(page).toHaveURL(
    '/baseline?scenario=default&seed=20260911&count=60',
  );
  await expect(
    page.getByRole('heading', { name: 'Live Market Explorer', level: 1 }),
  ).toBeVisible();
});

test('scenario links fit a mobile viewport and support keyboard navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const demos = page.getByRole('list', { name: 'Scenario demos' });
  for (const link of await demos.getByRole('link').all()) {
    await link.scrollIntoViewIfNeeded();
    const bounds = await link.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
  const optimized = demos.getByRole('link', {
    name: 'Open optimized: Large list',
    exact: true,
  });
  await demos
    .getByRole('link', { name: 'Open baseline: Large list', exact: true })
    .focus();
  await page.keyboard.press('Tab');
  await expect(optimized).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(
    '/optimized?scenario=large-list&seed=20260911&count=250',
  );
  await expect(page.getByTestId('market-table')).toBeVisible();
});

test('optimized scenario selection updates the route and follows browser Back', async ({
  page,
}) => {
  await page.goto(
    '/optimized?scenario=worker-aggregation&seed=42&count=3&aggregationPasses=40',
  );
  const selector = page.getByRole('combobox', {
    name: 'Scenario',
    exact: true,
  });
  await expect(selector).toHaveValue('worker-aggregation');
  await selector.selectOption('large-list');
  await expect(page).toHaveURL(
    '/optimized?scenario=large-list&seed=42&count=3',
  );
  await expect(page.getByTestId('scenario-config')).toHaveAttribute(
    'data-render-strategy',
    'optimized-virtual-list',
  );
  await expect(page.getByTestId('market-table')).toBeVisible();
  await page.goBack();
  await expect(selector).toHaveValue('worker-aggregation');
  await expect(page).toHaveURL(
    '/optimized?scenario=worker-aggregation&seed=42&count=3&aggregationPasses=40',
  );
});

test('Vietnamese Overview supports mobile language selection and scenario navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  const panel = page.getByRole('dialog', { name: 'Explore lab' });
  const selector = panel.getByRole('combobox', {
    name: 'Language',
    exact: true,
  });
  await expect(
    page
      .getByRole('complementary')
      .getByRole('combobox', { name: 'Language', exact: true }),
  ).toBeVisible();
  await selector.scrollIntoViewIfNeeded();
  const selectorBounds = await selector.boundingBox();
  expect(selectorBounds).not.toBeNull();
  expect(selectorBounds!.x).toBeGreaterThanOrEqual(0);
  expect(selectorBounds!.x + selectorBounds!.width).toBeLessThanOrEqual(390);
  expect(selectorBounds!.height).toBeGreaterThanOrEqual(44);
  await selector.focus();
  await expect(selector).toBeFocused();
  await selector.selectOption('vi');
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page.getByRole('main')).toHaveAttribute('lang', 'vi');
  await expect(
    page.getByRole('heading', { name: 'Cách sử dụng lab' }),
  ).toBeVisible();
  const links = page
    .getByRole('list', { name: 'Demo theo kịch bản' })
    .getByRole('link');
  for (const link of await links.all()) {
    const bounds = await link.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
  await page
    .getByRole('link', { name: 'Mở optimized: Danh sách lớn', exact: true })
    .click();
  await expect(page).toHaveURL(
    '/optimized?scenario=large-list&seed=20260911&count=250',
  );
  await expect(
    page.getByRole('heading', {
      name: 'Khám phá thị trường trực tiếp',
      level: 1,
    }),
  ).toBeVisible();
  await expect(page.getByTestId('market-table')).toBeVisible();
});

test('language persists across all five pages and preserves explorer interactions', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('combobox', { name: 'Language', exact: true })
    .selectOption('vi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await page.getByRole('link', { name: 'Mở Reference Explorer' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Khám phá thị trường tham chiếu',
      level: 1,
    }),
  ).toBeVisible();
  const search = page.getByRole('searchbox', { name: 'Tìm kiếm thị trường' });
  await search.fill('Market 1');
  await page
    .getByRole('combobox', { name: 'Danh mục', exact: true })
    .selectOption('technology');
  const referenceUrl = page.url();
  await page
    .getByRole('combobox', { name: 'Ngôn ngữ', exact: true })
    .selectOption('en');
  await expect(
    page.getByRole('searchbox', { name: 'Search markets' }),
  ).toHaveValue('Market 1');
  await expect(
    page.getByRole('combobox', { name: 'Category', exact: true }),
  ).toHaveValue('technology');
  await expect(page).toHaveURL(referenceUrl);
  await page
    .getByRole('combobox', { name: 'Language', exact: true })
    .selectOption('vi');
  const nav = page.getByRole('navigation', { name: 'Khám phá lab' });
  await nav.getByRole('link', { name: 'Tổng quan', exact: true }).click();
  await page
    .getByRole('link', { name: 'Mở baseline: Explorer mặc định', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Khám phá thị trường trực tiếp',
      level: 1,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Làm mới thị trường' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: /^Xem chi tiết / })
    .first()
    .click();
  await expect(
    page.getByRole('button', { name: 'Đóng chi tiết' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Đóng chi tiết' }).click();
  await nav.getByRole('link', { name: 'Tổng quan', exact: true }).click();
  await page
    .getByRole('link', { name: 'Mở optimized: Danh sách lớn', exact: true })
    .click();
  await expect(
    page.getByRole('combobox', { name: 'Kịch bản', exact: true }),
  ).toHaveValue('large-list');
  await expect(
    page.getByRole('option', { name: 'Danh sách lớn', exact: true }),
  ).toBeAttached();
  await nav
    .getByRole('link', { name: 'Nghiên cứu tình huống', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Nghiên cứu tình huống', level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Danh sách lớn', exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('combobox', { name: 'Kịch bản', exact: true }),
  ).toHaveValue('large-list');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await page.reload();
  await expect(
    page.getByRole('combobox', { name: 'Language', exact: true }),
  ).toHaveValue('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
