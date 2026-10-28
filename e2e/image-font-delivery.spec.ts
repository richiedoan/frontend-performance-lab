import { expect, test } from '@playwright/test';
for (const route of ['/baseline', '/optimized']) {
  test(`${route} image/font delivery is bounded, reserved as configured and isolated`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/delivery/')) requests.push(request.url());
    });
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/delivery/**', async (request) => {
      await gate;
      await request.continue();
    });
    await page.goto(`${route}?scenario=image-font-delivery&count=3`, {
      waitUntil: 'domcontentloaded',
    });
    const panel = page.getByTestId('image-font-delivery');
    await expect(panel).toBeVisible();
    const images = panel.getByRole('img');
    await expect(images).toHaveCount(3);
    const frame = page.getByTestId('delivery-frame').first();
    const before = (await frame.boundingBox())!;
    if (route === '/optimized') {
      expect(before.height).toBeGreaterThan(0);
      expect(Math.abs(before.width / before.height - 16 / 9)).toBeLessThan(
        0.01,
      );
      expect(
        (await page.getByTestId('delivery-frame').nth(1).boundingBox())!.y,
      ).toBeGreaterThan(720);
      await expect(images.nth(0)).toHaveAttribute('fetchpriority', 'high');
      await expect(images.nth(1)).toHaveAttribute('loading', 'lazy');
    } else expect(before.height).toBeLessThan(50);
    release();
    await expect
      .poll(() =>
        images
          .first()
          .evaluate(
            (node: HTMLImageElement) => node.complete && node.naturalWidth > 0,
          ),
      )
      .toBe(true);
    if (route === '/optimized') {
      expect((await frame.boundingBox())!.height).toBeCloseTo(before.height, 2);
      expect(
        await images
          .first()
          .evaluate((node: HTMLImageElement) => node.currentSrc),
      ).toMatch(/\.(avif|webp)$/);
    } else
      expect(
        await images
          .first()
          .evaluate((node: HTMLImageElement) => node.naturalWidth),
      ).toBe(2400);
    await images.nth(2).scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        images
          .nth(2)
          .evaluate(
            (node: HTMLImageElement) => node.complete && node.naturalWidth > 0,
          ),
      )
      .toBe(true);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await panel.evaluate((node) => getComputedStyle(node).fontFamily),
    ).toContain(route === '/optimized' ? 'DeliveryStable' : 'DeliverySwap');
    await page.waitForLoadState('networkidle');
    expect(new Set(requests).size).toBeLessThanOrEqual(4);
    await page.goto(`${route}?scenario=default&count=3`);
    await expect(panel).toHaveCount(0);
    // New context/page below confirms default does not depend on cache from the experiment.
  });
  test(`${route} cold default requests no experiment assets`, async ({
    page,
  }) => {
    const assets: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/delivery/')) assets.push(request.url());
    });
    await page.goto(`${route}?count=3`);
    await expect(page.getByTestId('market-table')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(assets).toEqual([]);
  });
}

test('optimized mobile selects a bounded responsive image without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/optimized?scenario=image-font-delivery&count=3');
  const image = page
    .getByTestId('image-font-delivery')
    .getByRole('img')
    .first();
  await expect
    .poll(() =>
      image.evaluate(
        (node: HTMLImageElement) => node.complete && node.naturalWidth > 0,
      ),
    )
    .toBe(true);
  expect(
    await image.evaluate((node: HTMLImageElement) => node.currentSrc),
  ).toMatch(/-480\.(avif|webp)$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      Array.from(document.fonts)
        .filter((font) => font.family.includes('DeliveryStable'))
        .map((font) => font.display),
    ),
  ).toContain('optional');
});
