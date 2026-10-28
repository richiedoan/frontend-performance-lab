import { test, expect } from '@playwright/test';

test('mobile sidebar supports dismissal, navigation and desktop resize', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Open menu' });
  await menu.click();
  const panel = page.getByRole('dialog', { name: 'Explore lab' });
  await expect(panel).toBeVisible();
  await expect(
    panel.getByRole('link', { name: 'Case Study', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(menu).toBeFocused();
  await menu.click();
  await page.mouse.click(5, 300);
  await expect(panel).toBeHidden();
  await menu.click();
  // Navigation behavior is independent of the reference page's 5,000-row workload.
  // Keep this UI check responsive by exercising its offline state.
  await page.route('**/api/markets**', (route) => route.abort());
  await panel.getByRole('link', { name: 'Reference', exact: true }).click();
  await expect(page).toHaveURL(/reference/);
  await expect(panel).toBeHidden();
  await menu.click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(panel).toBeHidden();
  await expect(menu).toBeHidden();
  await expect(
    page.getByRole('navigation', { name: 'Explore lab' }),
  ).toBeVisible();
});

test('sort and changing button labels stay stable; drawer dismisses outside', async ({
  page,
}) => {
  await page.goto('/optimized?scenario=large-list&count=20');
  await expect(page.getByTestId('market-table')).toBeVisible();
  for (const language of ['en', 'vi']) {
    await page
      .getByRole('combobox', { name: /Language|Ngôn ngữ/ })
      .selectOption(language);
    const refresh = page.getByTestId('market-refresh');
    const before = await refresh.boundingBox();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/markets?*', async (route) => {
      await held;
      await route.continue();
    });
    try {
      await refresh.click();
      await expect(refresh).toBeDisabled();
      expect((await refresh.boundingBox())?.width).toBe(before?.width);
    } finally {
      release();
    }
    await expect(page.getByTestId('market-table')).toBeVisible();
    await page.unroute('**/api/markets?*');
    const sort = page.locator('.market-sort-button').last();
    const width = (await sort.boundingBox())!.width;
    await sort.click();
    await expect(page.getByTestId('market-table')).toBeVisible();
    expect((await sort.boundingBox())!.width).toBe(width);
    const indicator = await sort.locator('span').boundingBox();
    const box = (await sort.boundingBox())!;
    expect(indicator!.y).toBeGreaterThanOrEqual(box.y);
    expect(indicator!.y + indicator!.height).toBeLessThanOrEqual(
      box.y + box.height,
    );
    const expand = page
      .getByTestId('market-row')
      .first()
      .locator('button')
      .first();
    const expandWidth = (await expand.boundingBox())!.width;
    await expand.click();
    expect((await expand.boundingBox())!.width).toBe(expandWidth);
    await expand.click();
  }
  await page.getByTestId('market-row').first().locator('button').last().click();
  const drawer = page.getByTestId('market-drawer');
  await expect(drawer).toBeVisible();
  await drawer.getByRole('heading').click();
  await expect(drawer).toBeVisible();
  await page.mouse.click(10, 300);
  await expect(drawer).toBeHidden();
});

for (const width of [320, 390, 940]) {
  test(`right sidebar keeps the close button fully inside at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const panel = page.getByRole('dialog', { name: 'Explore lab' });
    const close = panel.getByRole('button', { name: 'Close menu' });
    await expect
      .poll(async () => {
        const box = (await panel.boundingBox())!;
        return Math.round(box.x + box.width);
      })
      .toBe(width);
    const bounds = (await panel.boundingBox())!;
    const button = (await close.boundingBox())!;
    expect(bounds.x + bounds.width).toBeCloseTo(width, 0);
    expect(button.x).toBeGreaterThanOrEqual(bounds.x + 6);
    expect(button.x + button.width).toBeLessThanOrEqual(
      bounds.x + bounds.width - 6,
    );
    expect(button.y).toBeGreaterThanOrEqual(bounds.y + 6);
    expect(
      await panel.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    await close.click();
    await expect(panel).toBeHidden();
  });
}

test('mobile header stays reachable while scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, 1000));
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(500);
  const header = page.locator('.lab-mobile-header');
  await expect.poll(async () => (await header.boundingBox())?.y).toBe(0);
  await page.getByRole('button', { name: 'Open menu' }).click();
  const panel = page.getByRole('dialog', { name: 'Explore lab' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Close menu' }).click();
  await expect(panel).toBeHidden();
  await expect.poll(async () => (await header.boundingBox())?.y).toBe(0);
});

test('menu animates both directions and respects reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Open menu' });
  const panel = page.locator('#lab-mobile-menu');
  await menu.click();
  await expect
    .poll(() => panel.evaluate((node) => getComputedStyle(node).opacity))
    .toBe('1');
  await panel.getByRole('button', { name: 'Close menu' }).click();
  // Native close removes open immediately; the discrete transition retains the visual exit.
  await expect(panel).not.toHaveAttribute('open');
  expect(
    await panel.evaluate((node) =>
      node
        .getAnimations()
        .some((animation) => animation.playState === 'running'),
    ),
  ).toBe(true);
  await expect(panel).toBeHidden();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await menu.click();
  expect(await panel.evaluate((node) => node.getAnimations().length)).toBe(0);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});

test('market drawer animates dismissal and respects reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/optimized?scenario=large-list&count=20');
  const open = page.getByTestId('market-row').first().locator('button').last();
  const drawer = page.getByTestId('market-drawer');
  for (const method of ['close', 'escape', 'outside']) {
    await open.click();
    await expect
      .poll(() => drawer.evaluate((node) => getComputedStyle(node).opacity))
      .toBe('1');
    if (method === 'close') await page.getByTestId('market-close').click();
    else if (method === 'escape') await page.keyboard.press('Escape');
    else await page.mouse.click(10, 300);
    await expect(drawer).not.toHaveAttribute('open');
    expect(
      await drawer.evaluate((node) =>
        node
          .getAnimations()
          .some((animation) => animation.playState === 'running'),
      ),
    ).toBe(true);
    await expect(drawer).toBeHidden();
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open.click();
  expect(await drawer.evaluate((node) => node.getAnimations().length)).toBe(0);
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
});

test('expanded rows enter smoothly without animating their layout height', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/optimized?scenario=large-list&count=20');
  const expand = page
    .getByTestId('market-row')
    .first()
    .locator('button')
    .first();
  await expand.click();
  const content = page.locator('.virtual-expansion');
  await expect(content).toHaveCSS('animation-name', 'virtual-expansion-enter');
  const height = await content.evaluate(
    (node) => (node as HTMLElement).offsetHeight,
  );
  await content.evaluate(async (node) => {
    await Promise.all(
      node.getAnimations().map((animation) => animation.finished),
    );
  });
  expect(
    await content.evaluate((node) => (node as HTMLElement).offsetHeight),
  ).toBe(height);
  await expect(content).toHaveCSS('opacity', '1');
  await expand.click();
  await expect(content).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expand.click();
  await expect(content).toBeVisible();
  await expect(content).toHaveCSS('animation-name', 'none');
});

for (const route of ['baseline', 'optimized', 'reference']) {
  test(`${route} keeps table controls during initial load and refresh`, async ({
    page,
  }) => {
    let release!: () => void;
    let held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/markets?*', async (request) => {
      await held;
      await request.continue();
    });
    await page.goto(
      `/${route}?count=20${route === 'reference' ? '' : '&scenario=large-list'}`,
    );
    const table = page.getByRole('table', { name: 'Market records' });
    const sort = page.getByRole('button', { name: 'Sort by volume' });
    try {
      await expect(page.getByTestId('market-loading')).toBeVisible();
      await expect(table).toBeVisible();
      await expect(sort).toBeVisible();
      await expect(page.getByTestId('market-search')).toBeVisible();
      await expect(
        page.getByRole('combobox', { name: 'Category', exact: true }),
      ).toBeVisible();
      await expect(page.getByTestId('market-row')).toHaveCount(0);
    } finally {
      release();
    }
    await expect(page.getByTestId('market-table')).toBeVisible();
    held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.getByTestId('market-refresh').click();
    try {
      await expect(page.getByTestId('market-loading')).toBeVisible();
      await expect(table).toBeVisible();
      await expect(sort).toBeVisible();
      await expect(
        page.getByRole('combobox', { name: 'Status', exact: true }),
      ).toBeVisible();
      await sort.click();
      await expect(
        page.getByRole('columnheader', { name: 'Volume' }),
      ).toHaveAttribute('aria-sort', 'ascending');
    } finally {
      release();
    }
    await expect(page.getByTestId('market-table')).toBeVisible();
  });
}

test('table headers align with cells and Refresh stays still on hover', async ({
  page,
}) => {
  await page.goto('/optimized?scenario=large-list&count=20');
  await expect(page.getByTestId('market-table')).toBeVisible();
  const refresh = page.getByTestId('market-refresh');
  await page.locator('.lab-content').evaluate(async (node) => {
    await Promise.all(
      node.getAnimations().map((animation) => animation.finished),
    );
  });
  const before = await refresh.boundingBox();
  await refresh.hover();
  await expect(refresh).toHaveCSS('translate', 'none');
  expect(await refresh.boundingBox()).toEqual(before);
  await expect(refresh).toHaveCSS('cursor', 'pointer');
  const headers = page.getByRole('columnheader');
  const positions = await headers.evaluateAll((nodes) =>
    nodes.map((node) => ({
      y: node.getBoundingClientRect().y,
      height: node.getBoundingClientRect().height,
    })),
  );
  for (const position of positions) expect(position).toEqual(positions[0]);
  const sort = page.locator('.market-sort-button').first();
  await expect(sort).toHaveCSS('justify-content', 'flex-start');
  await expect(sort).toHaveCSS('border-top-width', '0px');
  await expect(
    page.getByRole('combobox', { name: 'Category', exact: true }),
  ).toHaveCSS('cursor', 'pointer');
});

for (const route of ['baseline', 'optimized']) {
  test(`${route} mobile markets stack without horizontal scrolling`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${route}?scenario=large-list&count=20`);
    const table = page.getByTestId('market-table');
    await expect(table).toBeVisible();
    const row = page.getByTestId('market-row').first();
    await expect(
      row.locator('.market-mobile-label', { hasText: 'Price' }),
    ).toBeVisible();
    await expect(row).toHaveCSS('display', 'grid');
    const assertFits = async () => {
      expect(
        await page
          .locator('.market-table-scroll')
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    };
    await assertFits();
    await page.getByRole('button', { name: 'Sort by volume' }).click();
    await expect(table.locator('th[aria-sort="ascending"]')).toContainText(
      'Volume',
    );
    await row.getByRole('button', { name: /^Expand / }).click();
    await expect(
      page.locator('.market-expansion-row:visible').first(),
    ).toBeVisible();
    await assertFits();
    await row.getByRole('button', { name: /^View details for/ }).click();
    await expect(page.locator('.market-drawer')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.market-drawer')).not.toBeVisible();
    if (route === 'optimized') {
      await page.evaluate(() => window.scrollBy(0, 400));
      await expect(page.getByTestId('market-row').last()).toBeVisible();
      await assertFits();
    }
    await page.setViewportSize({ width: 320, height: 740 });
    await assertFits();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(row).toHaveCSS('display', 'table-row');
  });
}

test('mobile sort cells fill their grid tracks with the full optimized dataset', async ({
  page,
}) => {
  await page.setViewportSize({ width: 440, height: 844 });
  await page.goto('/optimized?scenario=large-list&count=5000');
  const table = page.getByTestId('market-table');
  await expect(table).toBeVisible();
  const market = table.locator('thead th').nth(0);
  const price = table.locator('thead th').nth(1);
  const marketBox = await market.boundingBox();
  const priceBox = await price.boundingBox();
  expect(Math.abs(marketBox!.width - priceBox!.width)).toBeLessThan(1);
  await page.getByRole('button', { name: 'Sort by name' }).click();
  await expect(market).toHaveAttribute('aria-sort', 'descending');
  const scroller = page.getByTestId('market-virtual-scroll');
  await expect(scroller).toHaveCSS('touch-action', 'pan-y pinch-zoom');
  await scroller.evaluate((el) => {
    el.scrollLeft = 100;
  });
  expect(await scroller.evaluate((el) => el.scrollLeft)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    440,
  );
});

for (const route of ['reference', 'baseline', 'optimized']) {
  test(`${route} mobile viewport stays anchored after horizontal wheel gestures`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 440, height: 956 });
    await page.goto(`/${route}?count=20`);
    await expect(page.getByTestId('market-table')).toBeVisible();
    await page.evaluate(() => scrollTo(0, 180));
    const header = page.locator('.lab-mobile-header');
    await expect(header).toBeVisible();
    await page.mouse.move(220, 100);
    await page.mouse.wheel(300, 0);
    await expect.poll(() => page.evaluate(() => scrollX)).toBe(0);
    await expect.poll(async () => (await header.boundingBox())!.x).toBe(0);
    await expect(page.locator('html')).toHaveCSS('overflow-x', 'hidden');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(440);
    const title = await page.locator('.market-dashboard h1').boundingBox();
    expect(title!.x).toBeGreaterThanOrEqual(0);
    expect(title!.x + title!.width).toBeLessThanOrEqual(440);
  });
}

test('Overview touch gestures keep the viewport horizontal position fixed', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('.overview-challenges')).toBeVisible();
    await expect(page.locator('html')).toHaveCSS(
      'touch-action',
      'pan-y pinch-zoom',
    );
    const session = await context.newCDPSession(page);
    for (const top of [0, 800, 2000]) {
      await page.evaluate((y) => scrollTo(0, y), top);
      await session.send('Input.synthesizeScrollGesture', {
        x: 300,
        y: 300,
        xDistance: -180,
        yDistance: 0,
        gestureSourceType: 'touch',
      });
      expect(await page.evaluate(() => scrollX)).toBe(0);
      expect(await page.evaluate(() => visualViewport?.offsetLeft)).toBe(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(412);
    }
    await page.evaluate(() => scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    // Send an actual touch sequence across frames so the vertical pan is
    // independent of the preceding synthesized horizontal gestures.
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 200, y: 600 }],
    });
    try {
      for (let step = 1; step <= 10; step++) {
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve()),
            ),
        );
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: 200, y: 600 - step * 25 }],
        });
      }
    } finally {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
    }
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});

for (const route of ['baseline', 'optimized']) {
  test(`${route} refresh skeleton fills the mobile table width`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${route}?scenario=large-list&count=20`);
    await expect(page.getByTestId('market-table')).toBeVisible();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/markets?*', async (request) => {
      await held;
      await request.continue();
    });
    await page.getByTestId('market-refresh').click();
    try {
      const loading = page.getByTestId('market-loading');
      await expect(loading).toBeVisible();
      const table = page.getByRole('table', { name: 'Market records' });
      const box = await table.boundingBox();
      const skeleton = await loading.boundingBox();
      expect(Math.abs(box!.width - skeleton!.width)).toBeLessThan(2);
      expect(Math.abs(box!.x - skeleton!.x)).toBeLessThan(2);
    } finally {
      release();
    }
    await expect(page.getByTestId('market-table')).toBeVisible();
  });
}

for (const route of ['baseline', 'optimized']) {
  test(`${route} search completions wrap long queries on mobile`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto(`/${route}?scenario=search-input&count=20`);
    await expect(page.getByTestId('market-table')).toBeVisible();
    const query = 'market'.repeat(50);
    await page.getByTestId('market-search').fill(query);
    const diagnostics = page.getByTestId('search-diagnostics');
    await diagnostics.locator('summary').click();
    const completions = page.getByTestId('search-completions');
    await expect(completions).toContainText(query);
    expect(
      await completions.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    const box = await completions.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  });
}

test('mobile optimized list scrolls the summary off screen with the page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/optimized?scenario=large-list&count=5000');
  await expect(page.getByTestId('market-table')).toBeVisible();
  const scroller = page.getByTestId('market-virtual-scroll');
  await expect(scroller).toHaveAttribute('data-window-scroll', 'true');
  const summary = page.locator('.market-summary');
  const initial = await summary.boundingBox();
  await page.evaluate(() => scrollBy(0, 1400));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(1000);
  const after = await summary.boundingBox();
  expect(after!.y).toBeLessThan(initial!.y - 1000);
  expect(after!.y + after!.height).toBeLessThan(0);
  expect(await page.getByTestId('market-row').count()).toBeLessThan(50);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(scroller).toHaveAttribute('data-window-scroll', 'false');
});

test('mobile sort header stays below navigation while virtual cards scroll', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/optimized?scenario=large-list&count=5000');
  await expect(page.getByTestId('market-table')).toBeVisible();
  const header = page.locator('.market-table thead');
  const nav = page.locator('.lab-mobile-header');
  await page.evaluate(() => scrollTo(0, 1800));
  await expect
    .poll(async () => (await header.boundingBox())!.y)
    .toBeCloseTo(77, 0);
  expect((await nav.boundingBox())!.height).toBeCloseTo(69, 0);
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(180, 500);
    await page.mouse.wheel(0, 600);
    await expect
      .poll(async () => {
        const rows = await page.getByTestId('market-row').evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom };
          }),
        );
        return rows.some((row) => row.top < 500 && row.bottom > 500);
      })
      .toBe(true);
    await expect
      .poll(async () => (await header.boundingBox())!.y)
      .toBeCloseTo(77, 0);
  }
  expect(await page.getByTestId('market-row').count()).toBeLessThan(50);
});
