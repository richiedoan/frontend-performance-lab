// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import type { Page } from '@playwright/test';
const calls = vi.hoisted(() => [] as unknown[]);
vi.mock('@playwright/test', () => ({
  expect: (id: string) => ({
    toBeVisible: async (options: unknown) => {
      calls.push(['visible', id, options]);
    },
    toBeHidden: async () => {
      calls.push(['hidden', id]);
    },
    toBeFocused: async () => {
      calls.push(['focused', id]);
    },
  }),
}));
import { drawerJourney } from './drawer-journey';

describe('shared drawer journey', () => {
  it('retains real locator clicks and collector assertion deadlines', async () => {
    calls.length = 0;
    const page = {
      getByTestId: (id: string) => {
        if (id === 'market-row')
          return {
            first: () => ({
              toString: () => id,
              getAttribute: async () => 'record-1',
            }),
          };
        return {
          click: async (...args: unknown[]) => {
            calls.push(['click', id, args]);
          },
          toString: () => id,
        };
      },
    } as unknown as Page;
    const phases: string[] = [];
    await drawerJourney(page, async (name, action) => {
      phases.push(name);
      return action();
    });
    expect(phases).toEqual([
      'target-row',
      'target-identity',
      'click-detail-including-scroll',
      'drawer-visible',
      'chart-ready',
      'close-click',
      'drawer-hidden',
      'focus-restored',
    ]);
    expect(
      calls.map((entry) => {
        const [kind, id, ...rest] = entry as unknown[];
        return [kind, String(id), ...rest];
      }),
    ).toEqual([
      ['visible', 'market-row', { timeout: 60000 }],
      ['click', 'market-detail-record-1', []],
      ['visible', 'market-drawer', undefined],
      ['visible', 'detail-chart-svg', { timeout: 60000 }],
      ['click', 'market-close', []],
      ['hidden', 'market-drawer'],
      ['focused', 'market-detail-record-1'],
    ]);
  });
});
