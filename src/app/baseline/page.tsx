'use client';
import { useTranslation } from '../../i18n/useTranslation';
import { Suspense } from 'react';
import { BaselineRoute } from '../../features/market/baseline/BaselineExplorer';

export default function BaselinePage() {
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
      <BaselineRoute />
    </Suspense>
  );
}
