'use client';
import { useTranslation } from '../../../i18n/useTranslation';
import { MARKET_SELECTORS } from './market-selectors';

import Image from 'next/image';
import { StableButtonLabel } from './StableButtonLabel';
import { useId, type ReactNode } from 'react';
import type { MarketRecord } from '../data/market-record';

import type { MarketSort, MarketSortKey } from '../domain/market-query';
export type { MarketSort, MarketSortKey } from '../domain/market-query';
export interface MarketTableProps {
  placeholder?: ReactNode;
  loading?: boolean;
  records: readonly MarketRecord[];
  sort: MarketSort;
  onSort: (key: MarketSortKey) => void;
  onSelect: (id: string) => void;
  expansion?: {
    expandedIds: readonly string[];
    onToggle: (id: string) => void;
  };
}

export function TableHeader(props: Pick<MarketTableProps, 'sort' | 'onSort'>) {
  return (
    <thead>
      <TableHeaderRow {...props} />
    </thead>
  );
}
export function TableHeaderRow({
  sort,
  onSort,
}: Pick<MarketTableProps, 'sort' | 'onSort'>) {
  const t = useTranslation();

  return (
    <tr>
      {(['name', 'price', 'change', 'volume'] as const).map((key) => (
        <th
          key={key}
          scope="col"
          aria-sort={sort.key === key ? sort.direction : 'none'}
        >
          <button
            type="button"
            className="market-sort-button"
            data-testid={MARKET_SELECTORS.sort(key)}
            onClick={() => onSort(key)}
            aria-label={t('Sort by {key}', { key: t.text(key) })}
          >
            {t.text(
              key === 'name' ? 'Market' : key[0].toUpperCase() + key.slice(1),
            )}
            <span className="market-sort-indicator" aria-hidden="true">
              {sort.key === key
                ? sort.direction === 'ascending'
                  ? '↑'
                  : '↓'
                : '↕'}
            </span>
          </button>
        </th>
      ))}
      <th scope="col">{t('Category')}</th>
      <th scope="col">{t('Status')}</th>
      <th scope="col">{t('Details')}</th>
    </tr>
  );
}

export function MarketRow({
  record,
  onSelect,
  expanded = false,
  onToggle,
  rowIndex,
  striped = false,
}: {
  record: MarketRecord;
  onSelect: (id: string) => void;
  expanded?: boolean;
  onToggle?: (id: string) => void;
  rowIndex?: number;
  striped?: boolean;
}) {
  const expansionId = useId();
  return (
    <>
      <tr
        aria-rowindex={rowIndex}
        className="market-row"
        data-striped={striped}
        data-expanded={expanded}
        data-testid={MARKET_SELECTORS.row}
        data-market-id={record.id}
      >
        <MarketRowCells
          record={record}
          onSelect={onSelect}
          expanded={expanded}
          onToggle={onToggle}
          expansionId={expansionId}
        />
      </tr>
      {onToggle && (
        <tr
          aria-rowindex={rowIndex === undefined ? undefined : rowIndex + 1}
          id={expansionId}
          className="market-expansion-row"
          hidden={!expanded}
          data-testid={MARKET_SELECTORS.expanded(record.id)}
        >
          <MarketExpansionCells record={record} />
        </tr>
      )}
    </>
  );
}

export function MarketTable({
  placeholder,
  loading = false,
  records,
  sort,
  onSort,
  onSelect,
  expansion,
}: MarketTableProps) {
  const t = useTranslation();

  return (
    <div
      className="market-table-scroll"
      role="region"
      aria-label={t('Market records')}
      tabIndex={0}
    >
      <table
        aria-label={t('Market records')}
        className="market-table"
        aria-busy={loading}
        data-testid={placeholder ? undefined : MARKET_SELECTORS.table}
      >
        <TableHeader sort={sort} onSort={onSort} />
        <tbody>
          {placeholder && (
            <tr className="market-placeholder-row">
              <td colSpan={7}>{placeholder}</td>
            </tr>
          )}
          {records.map((record, index) => (
            <MarketRow
              key={record.id}
              striped={index % 2 === 1}
              record={record}
              onSelect={onSelect}
              expanded={expansion?.expandedIds.includes(record.id)}
              onToggle={expansion?.onToggle}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarketRowCells({
  record,
  onSelect,
  expanded = false,
  onToggle,
  expansionId,
}: {
  record: MarketRecord;
  onSelect: (id: string) => void;
  expanded?: boolean;
  onToggle?: (id: string) => void;
  expansionId?: string;
}) {
  const t = useTranslation();

  return (
    <>
      <th scope="row">
        <div className="market-identity">
          <Image
            className="market-image"
            src={record.image.src}
            alt={t('{name} icon', { name: record.name })}
            width={64}
            height={64}
            unoptimized
          />
          <span className="market-name" title={record.name}>
            {record.name}
          </span>
        </div>
      </th>
      <td>
        <span className="market-mobile-label" aria-hidden="true">
          {t('Price')}
        </span>
        $
        {record.price.toLocaleString(t.locale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          useGrouping: false,
        })}
      </td>
      <td
        className={
          record.change > 0
            ? 'market-change-positive'
            : record.change < 0
              ? 'market-change-negative'
              : 'market-change-neutral'
        }
      >
        <span className="market-mobile-label" aria-hidden="true">
          {t('Change')}
        </span>
        {record.change > 0 ? '+' : ''}
        {record.change.toLocaleString(t.locale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          useGrouping: false,
        })}
        %
      </td>
      <td>
        <span className="market-mobile-label" aria-hidden="true">
          {t('Volume')}
        </span>
        {record.volume.toLocaleString(t.locale)}
      </td>
      <td>
        <span className="market-mobile-label" aria-hidden="true">
          {t('Category')}
        </span>
        {t.text(record.category)}
      </td>
      <td>
        <span className="market-mobile-label" aria-hidden="true">
          {t('Status')}
        </span>
        <span className="market-status" data-status={record.status}>
          {t.text(record.status)}
        </span>
      </td>
      <td className="market-row-actions">
        {onToggle && (
          <button
            type="button"
            className="market-expand-button"
            data-testid={MARKET_SELECTORS.expand(record.id)}
            aria-label={t('{action} {name}', {
              action: t(expanded ? 'Collapse' : 'Expand'),
              name: record.name,
            })}
            aria-expanded={expanded}
            aria-controls={expansionId}
            onClick={() => onToggle(record.id)}
          >
            <StableButtonLabel
              active={t(expanded ? 'Collapse' : 'Expand')}
              labels={[t('Expand'), t('Collapse')]}
            />
          </button>
        )}
        <button
          type="button"
          className="market-detail-button"
          data-testid={MARKET_SELECTORS.detail(record.id)}
          aria-label={t('View details for {name}', { name: record.name })}
          onClick={() => onSelect(record.id)}
        >
          {t('View details')}
        </button>
      </td>
    </>
  );
}
export function MarketExpansionCells({ record }: { record: MarketRecord }) {
  const t = useTranslation();

  return (
    <td colSpan={7}>
      <dl>
        <dt>{t('Record ID')}</dt>
        <dd>{record.id}</dd>
        <dt>{t('Updated')}</dt>
        <dd>
          <time dateTime={record.updatedAt}>{record.updatedAt}</time>
        </dd>
      </dl>
    </td>
  );
}
