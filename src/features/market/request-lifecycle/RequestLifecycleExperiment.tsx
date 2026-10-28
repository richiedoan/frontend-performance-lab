'use client';
import { useTranslation } from '../../../i18n/useTranslation';
import { useEffect, useRef, useState } from 'react';
import type { MarketRecord } from '../data/market-record';
import { createLifecycleSession, type Snapshot } from './session';
export function RequestLifecycleExperiment({
  records,
  optimized,
}: {
  records: readonly MarketRecord[];
  optimized: boolean;
}) {
  const t = useTranslation();

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const session = useRef<ReturnType<typeof createLifecycleSession> | null>(
    null,
  );
  useEffect(() => {
    const current = createLifecycleSession(optimized, setSnapshot);
    session.current = current;
    return () => {
      current.dispose();
      session.current = null;
    };
  }, [records, optimized]);
  return (
    <section
      aria-label={t('Request lifecycle experiment')}
      data-testid="request-lifecycle"
      data-status={snapshot?.status ?? 'idle'}
      data-applied-version={snapshot?.appliedVersion ?? 0}
    >
      <button
        type="button"
        disabled={records.length < 2 || snapshot?.status === 'running'}
        onClick={() =>
          void session.current?.run(records[0], records[records.length - 1])
        }
      >
        {t('Run request race')}
      </button>
      {records.length < 2 && (
        <p role="status">{t('At least two records are required.')}</p>
      )}
      {snapshot?.status === 'running' && (
        <p role="status">{t('Requests running…')}</p>
      )}
      {snapshot?.status === 'error' && (
        <p role="alert">{t('Request failed. Run request race to retry.')}</p>
      )}
      <p data-testid="lifecycle-result">
        {snapshot?.record?.name ?? t('No response yet')}
      </p>
      <details>
        <summary>{t('Request lifecycle diagnostics')}</summary>
        <pre data-testid="lifecycle-events">
          {JSON.stringify(snapshot?.events ?? [])}
        </pre>
      </details>
    </section>
  );
}
