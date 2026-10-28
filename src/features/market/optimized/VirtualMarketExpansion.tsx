'use client';

import { useTranslation } from '../../../i18n/useTranslation';
import type { MarketRecord } from '../data/market-record';

export function VirtualMarketExpansion({ record }: { record: MarketRecord }) {
  const t = useTranslation();
  const prices = record.chartHistory.map((point) => point.price);
  const money = (value: number) =>
    value.toLocaleString(t.locale, { style: 'currency', currency: 'USD' });
  const date = (value: string) =>
    new Date(value).toLocaleString(t.locale, {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  return (
    <td colSpan={7} className="virtual-expansion-cell">
      <section
        className="virtual-expansion"
        aria-label={t('expandedSnapshot', { name: record.name })}
      >
        <header className="virtual-expansion-header">
          <div>
            <p className="virtual-expansion-eyebrow">{t('snapshotLabel')}</p>
            <h3>{record.name}</h3>
          </div>
          <p className="virtual-expansion-tags">
            <span>{t.text(record.category)}</span>
            <span>{t.text(record.status)}</span>
          </p>
        </header>
        <dl className="virtual-expansion-metrics">
          <div>
            <dt>{t('snapshotPrice')}</dt>
            <dd>{money(record.price)}</dd>
          </div>
          <div>
            <dt>{t('snapshotChange')}</dt>
            <dd>
              {record.change > 0 ? '+' : ''}
              {record.change.toLocaleString(t.locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              %
            </dd>
          </div>
          <div>
            <dt>{t('snapshotRange')}</dt>
            <dd>
              {prices.length
                ? `${money(Math.min(...prices))} – ${money(Math.max(...prices))}`
                : t('snapshotNoHistory')}
            </dd>
          </div>
          <div>
            <dt>{t('snapshotVolume')}</dt>
            <dd>{record.volume.toLocaleString(t.locale)}</dd>
          </div>
        </dl>
        <p className="virtual-expansion-context">
          {t('snapshotContext', { count: prices.length })}
        </p>
        <dl className="virtual-expansion-meta">
          <div>
            <dt>{t('Record ID')}</dt>
            <dd>
              <code>{record.id}</code>
            </dd>
          </div>
          <div>
            <dt>{t('snapshotUpdated')}</dt>
            <dd>
              <time dateTime={record.updatedAt}>
                {date(record.updatedAt)} UTC
              </time>
            </dd>
          </div>
        </dl>
      </section>
    </td>
  );
}
