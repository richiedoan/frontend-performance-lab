'use client';
import { useTranslation } from '../../../i18n/useTranslation';
import { useCallback, useState } from 'react';
import type { MarketSummary } from '../api/market-api';
import {
  BoundaryNote,
  MemoSummaryContent,
  SUMMARY_DISPLAY,
} from '../render-boundary/BoundaryPresentation';

function LocalNoteEditor() {
  const [note, setNote] = useState('');
  return <BoundaryNote value={note} onChange={setNote} />;
}
export function OptimizedRenderBoundarySummary({
  summary,
}: {
  summary: MarketSummary;
}) {
  const t = useTranslation();

  const [inspected, setInspected] = useState(false);
  const inspect = useCallback(() => setInspected(true), []);
  return (
    <section
      aria-label={t('Render boundary experiment')}
      data-testid="render-boundary-experiment"
    >
      <LocalNoteEditor />
      <MemoSummaryContent
        summary={summary}
        display={SUMMARY_DISPLAY}
        onInspect={inspect}
      />
      {inspected && (
        <p role="status">{t('Summary reflects the complete dataset.')}</p>
      )}
    </section>
  );
}
