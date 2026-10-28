'use client';
import { useTranslation } from '../../../i18n/useTranslation';
import { memo, useEffect, useRef } from 'react';
import { SummaryCards } from '../components/SummaryCards';
import type { MarketSummary } from '../api/market-api';

export const SUMMARY_DISPLAY = Object.freeze({
  description: 'Dataset summary',
});

function DevelopmentCommitCounter() {
  const t = useTranslation();

  const count = useRef(0);
  const output = useRef<HTMLOutputElement>(null);
  useEffect(() => {
    count.current++;
    if (output.current) output.current.textContent = String(count.current);
  });
  return (
    <label>
      {t('Summary render commits')}{' '}
      <output data-testid="summary-render-commits" ref={output}>
        0
      </output>
    </label>
  );
}

function SummaryContent({
  summary,
  display,
  onInspect,
}: {
  summary: MarketSummary;
  display: typeof SUMMARY_DISPLAY;
  onInspect: () => void;
}) {
  const t = useTranslation();

  return (
    <div data-testid="render-boundary-summary">
      <SummaryCards summary={summary} />
      <button type="button" onClick={onInspect}>
        {t('Explain summary')}
      </button>
      <span>{t.text(display.description)}</span>
      {process.env.NODE_ENV === 'development' && <DevelopmentCommitCounter />}
    </div>
  );
}

// The sole memo boundary in this experiment: note/inspection state does not change summary data.
export const MemoSummaryContent = memo(SummaryContent);

export function BoundaryNote({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslation();

  return (
    <label>
      {t('Comparison note')}{' '}
      <input
        data-testid="boundary-note"
        value={value}
        maxLength={160}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
