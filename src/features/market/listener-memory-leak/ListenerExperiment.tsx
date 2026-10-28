'use client';
import { useTranslation } from '../../../i18n/useTranslation';
import { useEffect, useState } from 'react';
import type { MarketRecord } from '../data/market-record';
import {
  dispatchListenerProbe,
  startListenerSession,
  type ListenerSample,
} from './listener-session';
export function ListenerExperiment({
  records,
  optimized,
}: {
  records: readonly MarketRecord[];
  optimized: boolean;
}) {
  const t = useTranslation();

  const [sample, setSample] = useState<ListenerSample | null>(null);
  useEffect(() => {
    const session = startListenerSession(records, optimized, setSample);
    return () => session.unmount();
  }, [records, optimized]);
  return (
    <section
      aria-label={t('Event listener experiment')}
      data-testid="listener-experiment"
      data-session={sample?.session}
    >
      <h2>{t('Listener snapshot probe')}</h2>
      <button type="button" onClick={() => dispatchListenerProbe(optimized)}>
        {t('Dispatch listener probe')}
      </button>
      <button
        type="button"
        onClick={() => dispatchListenerProbe(optimized, true)}
      >
        {t('Reset experiment listeners')}
      </button>
      <p role="status">
        {sample?.phase === 'limit'
          ? t(
              'Listener safety limit reached. Reset listeners, then refresh to register again.',
            )
          : sample?.phase === 'remove'
            ? t('Listeners removed. Refresh to register again.')
            : t('Snapshot volume {volume} across {count} sampled records.', {
                volume: sample?.volume ?? 0,
                count: sample?.records ?? 0,
              })}
      </p>
    </section>
  );
}
