'use client';
import { useTranslation } from '../../i18n/useTranslation';
import { Suspense } from 'react';
import { ReferenceRoute } from '../../features/market/reference/ReferenceExplorer';

export default function ReferencePage() {
  const t = useTranslation();

  return (
    <Suspense
      fallback={
        <main>
          <h1>{t('Reference Market Explorer')}</h1>
          <p role="status">{t('Loading markets…')}</p>
        </main>
      }
    >
      <ReferenceRoute />
    </Suspense>
  );
}
