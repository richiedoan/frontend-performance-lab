'use client';
import { useTranslation } from '../../../i18n/useTranslation';
import { useEffect, useRef, useState } from 'react';
import type { MarketRecord } from '../data/market-record';
import type { MarketQuery } from '../domain/market-query';
import { parseAggregationPasses } from './aggregate';
import type {
  AggregationFactory,
  AggregationSession,
  AggregationSnapshot,
} from './protocol';

export function AggregationExperiment({
  records,
  query,
  initialPasses,
  factory,
}: {
  records: readonly MarketRecord[] | null;
  query: MarketQuery;
  initialPasses: number;
  factory: AggregationFactory;
}) {
  const t = useTranslation();

  const [text, setText] = useState(String(initialPasses));
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<AggregationSnapshot | null>(null);
  const session = useRef<AggregationSession | null>(null);
  let passes: number | null = null;
  try {
    passes = parseAggregationPasses(text);
  } catch {
    /* Invalid input is shown below, never submitted. */
  }
  const enabledRecords = passes === null ? null : records;
  useEffect(() => {
    if (!enabledRecords) return;
    const current = factory(setSnapshot);
    session.current = current;
    return () => {
      current.dispose();
      session.current = null;
    };
  }, [enabledRecords, factory]);
  useEffect(() => {
    if (enabledRecords && passes !== null)
      session.current?.update({ records: enabledRecords, query, passes });
  }, [enabledRecords, query, passes, revision, factory]);
  const current =
    snapshot?.input.records === records &&
    snapshot.input.passes === passes &&
    JSON.stringify(snapshot.input.query) === JSON.stringify(query);
  return (
    <section
      className="aggregation-experiment"
      aria-label={t('Aggregation experiment')}
      data-testid="aggregation-experiment"
      data-version={snapshot?.state.version ?? 0}
      data-started-count={snapshot?.startedCount ?? 0}
      data-started-at={
        snapshot?.state.status === 'running'
          ? snapshot.state.startedAt
          : undefined
      }
      data-cancelled-count={snapshot?.cancelledCount ?? 0}
    >
      <label>
        {t('Aggregation passes')}{' '}
        <input
          data-testid="aggregation-passes"
          type="number"
          min={1}
          max={100}
          step={1}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      {passes === null ? (
        <p role="alert">
          {t('Aggregation passes must be an integer from 1 to 100.')}
        </p>
      ) : !records ||
        !snapshot ||
        !current ||
        snapshot.state.status === 'running' ? (
        <p role="status" data-testid="aggregation-running">
          {t('Aggregating…')}
        </p>
      ) : snapshot.state.status === 'error' ? (
        <div role="alert">
          <p>{t.text(snapshot.state.message)}</p>
          <button
            type="button"
            onClick={() => setRevision((value) => value + 1)}
          >
            {t('Retry aggregation')}
          </button>
        </div>
      ) : (
        <pre
          data-testid="aggregation-output"
          data-result-version={snapshot.state.version}
        >
          {JSON.stringify(snapshot.state.output)}
        </pre>
      )}
      <details>
        <summary>{t('Aggregation job diagnostics')}</summary>
        <p>
          {t(
            'Job times use the page performance.now() clock; completion includes message delivery. Last 50 terminal events.',
          )}
        </p>
        <pre data-testid="aggregation-events">
          {JSON.stringify(snapshot?.events ?? [])}
        </pre>
      </details>
    </section>
  );
}
