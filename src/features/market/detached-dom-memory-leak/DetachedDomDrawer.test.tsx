import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { DetachedDomDrawer } from './DetachedDomDrawer';
import { baselineDrawerRetention, createDrawerRetention } from './retention';
import { DetailChart } from '../components/DetailChart';
import { generateMarketRecords } from '../data/generate-market-records';
const record = generateMarketRecords({ count: 1 })[0];
beforeEach(() => {
  // jsdom lacks native dialog APIs; browser tests verify actual modal behavior.
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
      },
    },
  });
});
afterEach(() => baselineDrawerRetention.clear());
for (const optimized of [false, true]) {
  it(`${optimized} repeated drawer closes retain only the intended references`, () => {
    const props = { optimized, Chart: DetailChart, onClose: () => {} };
    const view = render(
      <StrictMode>
        <DetachedDomDrawer {...props} record={null} />
      </StrictMode>,
    );
    for (let i = 0; i < 6; i++) {
      view.rerender(
        <StrictMode>
          <DetachedDomDrawer {...props} record={record} />
        </StrictMode>,
      );
      const root = screen.getByTestId('detached-chart-root');
      expect(root.isConnected).toBe(true);
      view.rerender(
        <StrictMode>
          <DetachedDomDrawer {...props} record={null} />
        </StrictMode>,
      );
      expect(root.isConnected).toBe(false);
      fireEvent.click(
        screen.getByRole('button', { name: 'Inspect retained references' }),
      );
      const snapshot = JSON.parse(
        screen.getByTestId('detached-dom-snapshot').textContent!,
      );
      expect(snapshot.retainedRoots).toBe(optimized ? 0 : Math.min(i + 1, 4));
      expect(snapshot.disconnectedRoots).toBe(snapshot.retainedRoots);
      expect(snapshot.recordIds.length).toBeLessThanOrEqual(4);
    }
    fireEvent.click(
      screen.getByRole('button', { name: 'Reset retained references' }),
    );
    expect(
      JSON.parse(screen.getByTestId('detached-dom-snapshot').textContent!),
    ).toEqual({
      retainedRoots: 0,
      disconnectedRoots: 0,
      retainedElements: 0,
      recordIds: [],
    });
    view.unmount();
  });
}
it('optimized cache stores only serializable IDs, never node references', () => {
  const store = createDrawerRetention(false);
  const node = document.createElement('div');
  node.innerHTML = '<svg><path /></svg>';
  store.capture(node, 'market-1');
  expect(JSON.parse(JSON.stringify(store.inspect()))).toEqual({
    retainedRoots: 0,
    disconnectedRoots: 0,
    retainedElements: 0,
    recordIds: ['market-1'],
  });
  store.clear();
  expect(store.inspect().recordIds).toEqual([]);
});
