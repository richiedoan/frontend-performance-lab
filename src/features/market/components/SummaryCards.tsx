'use client';
import { useTranslation } from '../../../i18n/useTranslation';
import { MARKET_SELECTORS } from './market-selectors';
import type { MarketSummary } from '../api/market-api';

export function SummaryCards({ summary }: { summary: MarketSummary }) {
  const t = useTranslation();

  const values = [
    ['Markets', summary.totalRecords.toLocaleString(t.locale)],
    ['Total volume', summary.totalVolume.toLocaleString(t.locale)],
    [
      'Average price',
      summary.averagePrice === null
        ? 'Not available'
        : `$${summary.averagePrice.toLocaleString(t.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`,
    ],
    [
      'Average change',
      summary.averageChange === null
        ? 'Not available'
        : `${summary.averageChange.toLocaleString(t.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}%`,
    ],
  ];
  return (
    <section
      aria-label={t('Market summary')}
      data-testid={MARKET_SELECTORS.summary}
    >
      <dl className="market-summary">
        {values.map(([label, value]) => (
          <div className="market-summary-card" key={label}>
            <dt>{t.text(label)}</dt>
            <dd>{t.text(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
