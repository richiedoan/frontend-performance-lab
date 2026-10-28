'use client';
import { useTranslation } from '../../i18n/useTranslation';
import { Suspense } from 'react';
import { OptimizedRoute } from '../../features/market/optimized/OptimizedExplorer';

export default function OptimizedPage() {
  const t = useTranslation();

  return (
    <Suspense
      fallback={
        <main>
          <h1>{t('Live Market Explorer')}</h1>
          <p role="status">{t('Loading markets…')}</p>
        </main>
      }
    >
      <OptimizedRoute />
    </Suspense>
  );
}
