import type { Page } from '@playwright/test';
import { MARKET_SELECTORS } from '../../src/features/market/components/market-selectors';

/** On-demand DOM inspection only; never installed in the application lifecycle. */
export async function inspectBaselineList(page: Page) {
  return page.locator('[data-render-strategy="baseline-full-list"]').evaluate(
    (root, selectors) => {
      const table = root.querySelector(`[data-testid="${selectors.table}"]`);
      const rows = root.querySelectorAll(`[data-testid="${selectors.row}"]`);
      function countNodes(node: Node | null) {
        if (!node) return 0;
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_ALL);
        let count = 1;
        while (walker.nextNode()) count++;
        return count;
      }
      return {
        configuredCount: Number(root.getAttribute('data-dataset-count')),
        seed: Number(root.getAttribute('data-dataset-seed')),
        renderedRows: rows.length,
        ids: Array.from(rows, (row) => row.getAttribute('data-market-id')),
        // Include the scope root and all element/text/comment descendants.
        scopeDomNodes: countNodes(root),
        tableDomNodes: countNodes(table),
      };
    },
    { table: MARKET_SELECTORS.table, row: MARKET_SELECTORS.row },
  );
}
