'use client';
import { useTranslation } from '../../../i18n/useTranslation';
import { lazy, Suspense } from 'react';
import type { MarketRecord } from '../data/market-record';
export const preloadDetailChart = () => import('../components/DetailChart');
const Chart = lazy(() =>
  preloadDetailChart().then((module) => ({ default: module.DetailChart })),
);
export function LazyDetailChart({ record }: { record: MarketRecord }) {
  const t = useTranslation();

  return (
    <Suspense
      fallback={
        <figure className="market-chart" aria-busy="true">
          <p role="status">{t('Loading price history…')}</p>
          <figcaption>{t('Price history (USD)')}</figcaption>
        </figure>
      }
    >
      <Chart record={record} />
    </Suspense>
  );
}
