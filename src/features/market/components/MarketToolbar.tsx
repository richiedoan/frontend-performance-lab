'use client';
import { StableButtonLabel } from './StableButtonLabel';
import { useTranslation } from '../../../i18n/useTranslation';
import { MARKET_SELECTORS } from './market-selectors';

import { useId } from 'react';
import { MARKET_CATEGORIES, MARKET_STATUSES } from '../data/market-record';
import type { MarketFiltersValue } from '../domain/market-query';
export type { MarketFiltersValue } from '../domain/market-query';

export function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslation();

  const id = useId();
  return (
    <div className="market-field">
      <label htmlFor={id}>{t('Search markets')}</label>
      <input
        id={id}
        type="search"
        data-testid={MARKET_SELECTORS.search}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function MarketFilters({
  value,
  onChange,
}: {
  value: MarketFiltersValue;
  onChange: (value: MarketFiltersValue) => void;
}) {
  const t = useTranslation();

  const id = useId();
  return (
    <fieldset className="market-filters">
      <legend>{t('Filter markets')}</legend>
      <div className="market-field">
        <label htmlFor={`${id}-category`}>{t('Category')}</label>
        <select
          id={`${id}-category`}
          data-testid={MARKET_SELECTORS.category}
          value={value.category}
          onChange={(event) =>
            onChange({
              ...value,
              category: event.target.value as MarketFiltersValue['category'],
            })
          }
        >
          <option value="all">{t('All categories')}</option>
          {MARKET_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {t.text(category)}
            </option>
          ))}
        </select>
      </div>
      <div className="market-field">
        <label htmlFor={`${id}-status`}>{t('Status')}</label>
        <select
          id={`${id}-status`}
          data-testid={MARKET_SELECTORS.status}
          value={value.status}
          onChange={(event) =>
            onChange({
              ...value,
              status: event.target.value as MarketFiltersValue['status'],
            })
          }
        >
          <option value="all">{t('All statuses')}</option>
          {MARKET_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t.text(status)}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}

export interface MarketToolbarProps {
  search: string;
  filters: MarketFiltersValue;
  onSearchChange: (value: string) => void;
  onFiltersChange: (value: MarketFiltersValue) => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

export function MarketToolbar({
  search,
  filters,
  onSearchChange,
  onFiltersChange,
  onRefresh,
  refreshing = false,
}: MarketToolbarProps) {
  const t = useTranslation();

  return (
    <section className="market-toolbar" aria-label={t('Market controls')}>
      <SearchInput value={search} onChange={onSearchChange} />
      <MarketFilters value={filters} onChange={onFiltersChange} />
      <button
        type="button"
        className="market-refresh-button"
        data-testid={MARKET_SELECTORS.refresh}
        onClick={onRefresh}
        disabled={refreshing}
      >
        <StableButtonLabel
          active={refreshing ? t('Refreshing…') : t('Refresh markets')}
          labels={[t('Refresh markets'), t('Refreshing…')]}
        />
      </button>
    </section>
  );
}
