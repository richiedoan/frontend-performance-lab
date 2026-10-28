import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export type JourneyPhase = <T>(
  name: string,
  action: () => Promise<T>,
) => Promise<T>;

/** Collector and diagnostics share pointer semantics and all readiness deadlines. */
export async function drawerJourney(
  page: Page,
  phase: JourneyPhase = (_name, action) => action(),
) {
  const row = page.getByTestId('market-row').first();
  await phase('target-row', () => expect(row).toBeVisible({ timeout: 60000 }));
  const id = await phase('target-identity', () =>
    row.getAttribute('data-market-id'),
  );
  if (!id) throw new Error('Missing stable record identity');
  await phase('click-detail-including-scroll', () =>
    page.getByTestId(`market-detail-${id}`).click(),
  );
  await phase('drawer-visible', () =>
    expect(page.getByTestId('market-drawer')).toBeVisible(),
  );
  await phase('chart-ready', () =>
    expect(page.getByTestId('detail-chart-svg')).toBeVisible({
      timeout: 60000,
    }),
  );
  await phase('close-click', () => page.getByTestId('market-close').click());
  await phase('drawer-hidden', () =>
    expect(page.getByTestId('market-drawer')).toBeHidden(),
  );
  await phase('focus-restored', () =>
    expect(page.getByTestId(`market-detail-${id}`)).toBeFocused(),
  );
}
