'use client';
import { useTranslation } from '../../../i18n/useTranslation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from 'react';
import { DetailDrawer } from '../components/DetailDrawer';
import type { MarketRecord } from '../data/market-record';
import {
  baselineDrawerRetention,
  createDrawerRetention,
  type DrawerRetention,
} from './retention';
type ChartType = ComponentProps<typeof DetailDrawer>['Chart'];
const RetentionContext = createContext<{
  store: DrawerRetention;
  Chart: ChartType;
} | null>(null);
function RetainedChart({ record }: { record: MarketRecord }) {
  const context = useContext(RetentionContext)!;
  const { store, Chart } = context;
  const id = record.id;
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      // Capture the actual rendered root, not a clone. React removes it on close.
      return () => store.capture(node, id);
    },
    [store, id],
  );
  return (
    <div key={id} ref={ref} data-testid="detached-chart-root">
      <Chart record={record} />
    </div>
  );
}
export function DetachedDomDrawer({
  optimized,
  Chart,
  ...props
}: ComponentProps<typeof DetailDrawer> & { optimized: boolean }) {
  const t = useTranslation();

  const [store] = useState(() =>
    optimized ? createDrawerRetention(false) : baselineDrawerRetention,
  );
  const [snapshot, setSnapshot] = useState<ReturnType<
    DrawerRetention['inspect']
  > | null>(null);
  const context = useMemo(() => ({ store, Chart }), [store, Chart]);
  useEffect(
    () => () => {
      if (optimized) store.clear();
    },
    [store, optimized],
  );
  function inspect() {
    const result = store.inspect();
    setSnapshot(result);
    if (typeof performance.mark === 'function') {
      // One replaceable diagnostic entry, containing no DOM references.
      const name = `detached-dom:${optimized ? 'optimized' : 'baseline'}:inspect`;
      performance.clearMarks(name);
      performance.mark(name, { detail: result });
    }
  }
  return (
    <RetentionContext.Provider value={context}>
      <DetailDrawer {...props} Chart={RetainedChart} />
      <section
        aria-label={t('Detached DOM diagnostics')}
        data-testid="detached-dom-diagnostics"
      >
        <button type="button" onClick={inspect}>
          {t('Inspect retained references')}
        </button>
        <button
          type="button"
          onClick={() => {
            store.clear();
            inspect();
          }}
        >
          {t('Reset retained references')}
        </button>
        <p>
          {t(
            'Inspect after closing the drawer. Baseline cache holds at most four chart roots.',
          )}
        </p>
        <output data-testid="detached-dom-snapshot">
          {snapshot ? JSON.stringify(snapshot) : t('Not inspected')}
        </output>
      </section>
    </RetentionContext.Provider>
  );
}
