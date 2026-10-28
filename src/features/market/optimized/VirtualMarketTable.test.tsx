import type { ReactElement } from 'react';
import { VirtuosoMockContext } from 'react-virtuoso';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { VirtualMarketTable } from './VirtualMarketTable';
import { generateMarketRecords } from '../data/generate-market-records';

const originalScrollTo = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'scrollTo',
);
// jsdom has no layout; retain the real virtualizer and supply browser geometry.
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(
    function (this: HTMLElement) {
      return this.dataset.testid === 'market-virtual-scroll'
        ? 560
        : this.tagName === 'THEAD'
          ? 80
          : 88;
    },
  );
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1024);
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(
    440080,
  );
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: this.offsetHeight,
        right: 1024,
        width: 1024,
        height: this.offsetHeight,
        toJSON() {},
      };
    },
  );
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: function (this: HTMLElement, options: ScrollToOptions) {
      this.scrollTop = options.top ?? 0;
      this.dispatchEvent(new Event('scroll'));
    },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalScrollTo)
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalScrollTo);
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo');
});
function renderWithGeometry(element: ReactElement) {
  return render(
    <VirtuosoMockContext.Provider
      value={{ viewportHeight: 560, itemHeight: 88 }}
    >
      {element}
    </VirtuosoMockContext.Provider>,
  );
}
const records = generateMarketRecords({ count: 5000, seed: 20260911 });
const props = {
  records,
  sort: { key: 'name', direction: 'ascending' } as const,
  onSort: vi.fn(),
  onSelect: vi.fn(),
  expansion: { expandedIds: [], onToggle: vi.fn() },
  resetKey: 'initial',
};
it('uses the real virtualizer to mount a bounded window with logical table positions', () => {
  renderWithGeometry(<VirtualMarketTable {...props} />);
  expect(screen.getAllByTestId('market-row').length).toBeGreaterThan(0);
  expect(screen.getAllByTestId('market-row').length).toBeLessThanOrEqual(16);
  expect(screen.getByTestId('market-table')).toHaveAttribute(
    'aria-rowcount',
    '5001',
  );
  expect(screen.getAllByTestId('market-row')[0]).toHaveAttribute(
    'aria-rowindex',
    '2',
  );
  expect(
    screen.queryByTestId(`market-detail-${records[4999].id}`),
  ).not.toBeInTheDocument();
});
it('mounts and focuses a distant record using End, then Home, without losing identity', async () => {
  renderWithGeometry(<VirtualMarketTable {...props} />);
  const first = screen.getByTestId(`market-detail-${records[0].id}`);
  await act(async () => {
    first.focus();
  });
  fireEvent.keyDown(first, { key: 'End' });
  const last = await screen.findByTestId(`market-detail-${records[4999].id}`);
  await waitFor(() => expect(last).toHaveFocus());
  fireEvent.click(last);
  expect(props.onSelect).toHaveBeenCalledWith(records[4999].id);
  expect(screen.getAllByTestId('market-row').length).toBeLessThanOrEqual(16);
  fireEvent.keyDown(last, { key: 'Home' });
  await waitFor(() =>
    expect(screen.getByTestId(`market-detail-${records[0].id}`)).toHaveFocus(),
  );
});
it('uses the supplied filtered records and preserves shared row callbacks', () => {
  renderWithGeometry(
    <VirtualMarketTable
      {...props}
      records={[records[4999]]}
      resetKey="filtered"
    />,
  );
  expect(screen.getAllByTestId('market-row')).toHaveLength(1);
  fireEvent.click(screen.getByTestId(`market-expand-${records[4999].id}`));
  expect(props.expansion.onToggle).toHaveBeenCalledWith(records[4999].id);
});
