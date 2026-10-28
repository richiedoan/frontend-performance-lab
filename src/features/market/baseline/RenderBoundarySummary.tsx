'use client';
import { useTranslation } from '../../../i18n/useTranslation';
import { useState } from 'react';
import type { MarketSummary } from '../api/market-api';
import {
  BoundaryNote,
  MemoSummaryContent,
} from '../render-boundary/BoundaryPresentation';

export function BaselineRenderBoundarySummary({
  summary,
}: {
  summary: MarketSummary;
}) {
  const t = useTranslation();

  const [note, setNote] = useState('');
  const [inspected, setInspected] = useState(false);
  return (
    <section
      aria-label={t('Render boundary experiment')}
      data-testid="render-boundary-experiment"
    >
      <BoundaryNote value={note} onChange={setNote} />
      <MemoSummaryContent
        summary={{ ...summary }}
        display={{ description: 'Dataset summary' }}
        onInspect={() => setInspected(true)}
      />
      {inspected && (
        <p role="status">{t('Summary reflects the complete dataset.')}</p>
      )}
    </section>
  );
}
