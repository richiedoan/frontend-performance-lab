'use client';
import { useTranslation } from '../../../i18n/useTranslation';
import type { MarketRecord } from '../data/market-record';
export function DetailChart({ record }: { record: MarketRecord }) {
  const t = useTranslation();

  const history = record.chartHistory;
  const prices = history.map((point) => point.price);
  const min = Math.min(...prices);
  const range = Math.max(...prices) - min || 1;
  const points = history
    .map(
      (point, index) =>
        `${10 + (index / Math.max(1, history.length - 1)) * 380},${150 - ((point.price - min) / range) * 130}`,
    )
    .join(' ');

  return (
    <figure className="market-chart">
      {history.length > 0 ? (
        <svg
          data-testid="detail-chart-svg"
          viewBox="0 0 400 180"
          role="img"
          aria-label={t('Price history for {name}, {count} points in USD', {
            name: record.name,
            count: history.length,
          })}
        >
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      ) : (
        <p role="status">{t('No price history available.')}</p>
      )}
      <figcaption>{t('Price history (USD)')}</figcaption>
    </figure>
  );
}
