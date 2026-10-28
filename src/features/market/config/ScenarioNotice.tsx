'use client';
import { useTranslation } from '../../../i18n/useTranslation';
import Link from 'next/link';
import type { ScenarioConfig } from './scenario-config';

export function ScenarioNotice({ config }: { config: ScenarioConfig }) {
  const t = useTranslation();

  if (process.env.NODE_ENV !== 'development') return null;
  return (
    <aside
      className="scenario-notice"
      aria-label={t('Development scenario')}
      data-testid="scenario-indicator"
    >
      {t('Scenario: ')}
      {config.scenario}
      {t(' · seed: ')}
      {config.seed}
      {t(' · records:')} {config.count}
    </aside>
  );
}

export function ConfigurationError({
  message,
  route,
}: {
  message: string;
  route: '/baseline' | '/optimized';
}) {
  const t = useTranslation();

  return (
    <main className="market-dashboard">
      <h1>{t('Live Market Explorer')}</h1>
      <p role="alert" data-testid="market-error">
        {t('Invalid configuration: ')}
        {t.text(message)}
      </p>
      <Link href={route}>{t('Reset configuration')}</Link>
    </main>
  );
}
