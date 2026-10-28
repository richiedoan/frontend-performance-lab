'use client';
import { useTranslation } from '../../../i18n/useTranslation';
import { MARKET_SELECTORS } from './market-selectors';

export function LoadingSkeleton() {
  const t = useTranslation();

  return (
    <div
      className="market-state"
      role="status"
      data-testid={MARKET_SELECTORS.loading}
    >
      <p>{t('Loading markets…')}</p>
      <div aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <div className="market-skeleton-row" key={index}>
            <span className="market-skeleton-image" />
            <span className="market-skeleton-line" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  message = 'No markets match your selection.',
}: {
  message?: string;
}) {
  const t = useTranslation();
  return (
    <div
      className="market-state"
      role="status"
      data-testid={MARKET_SELECTORS.empty}
    >
      <p>{t.text(message)}</p>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const t = useTranslation();

  return (
    <div className="market-state">
      <p role="alert" data-testid={MARKET_SELECTORS.error}>
        {t.text(message)}
      </p>
      <button
        type="button"
        data-testid={MARKET_SELECTORS.retry}
        onClick={onRetry}
      >
        {t('Retry')}
      </button>
    </div>
  );
}
