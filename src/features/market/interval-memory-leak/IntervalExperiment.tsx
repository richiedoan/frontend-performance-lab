'use client';
import { useTranslation } from '../../../i18n/useTranslation';
import { useEffect, useState } from 'react';
import type { MarketRecord } from '../data/market-record';
import { startIntervalSession, type IntervalEvent } from './interval-session';
export function IntervalExperiment({
  records,
  optimized,
}: {
  records: readonly MarketRecord[];
  optimized: boolean;
}) {
  const t = useTranslation();

  const [sample, setSample] = useState<IntervalEvent | null>(null);
  useEffect(() => {
    const session = startIntervalSession(records, optimized, setSample);
    return () => session.unmount();
  }, [records, optimized]);
  return (
    <section
      aria-label={t('Interval auto-refresh experiment')}
      data-testid="interval-experiment"
      data-session={sample?.session}
      data-tick={sample?.tick ?? 0}
    >
      <h2>{t('Snapshot auto-refresh')}</h2>
      <p role="status">
        {t('Refresh ')}
        {sample?.tick ?? 0}
        {t(' of 20; volume ')}
        {sample?.totalVolume ?? 0} {t('across ')}
        {sample?.records ?? 0}
        {t(' sampled records.')}
      </p>
      <p>
        {t(
          'Local summary only. One tick per second, up to 20 ticks; no network requests.',
        )}
      </p>
    </section>
  );
}
