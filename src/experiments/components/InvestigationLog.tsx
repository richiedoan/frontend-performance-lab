'use client';
import { useTranslation } from '../../i18n/useTranslation';
import type { Investigation } from '../data/types/investigation';
import type { Artifact, MissingResult } from '../data/types/experiment';
function Reference({
  label,
  value,
}: {
  label: string;
  value: Artifact | MissingResult;
}) {
  const t = useTranslation();
  return (
    <p>
      {label}:{' '}
      {'status' in value ? (
        t('Not available — {reason}', { reason: t.text(value.reason) })
      ) : (
        <a href={`/${value.path}`}>{value.path}</a>
      )}
    </p>
  );
}
export function InvestigationLog({ records }: { records: Investigation[] }) {
  const t = useTranslation();

  const verified = records.filter(
    (record) =>
      record.status === 'verified' &&
      ['accepted', 'rejected'].includes(record.decision),
  );
  return (
    <section aria-labelledby="investigation-heading">
      <p>{t('Original evidence text is preserved in its source language.')}</p>
      <h2 id="investigation-heading">{t('AI-assistance investigations')}</h2>
      {!verified.length && (
        <p>
          {t('No verified accepted or rejected suggestions are available.')}
        </p>
      )}
      {verified.map((record) => (
        <article key={record.id} aria-labelledby={`investigation-${record.id}`}>
          <h3 id={`investigation-${record.id}`}>
            <span lang="en">{record.question}</span>
          </h3>
          <p>
            {t('Experiment: ')}
            {record.experimentId}
            {t(' · Decision: ')}
            {t.text(record.decision)}
          </p>
          <p>
            {t('AI hypothesis: ')}
            <span lang="en">{record.aiHypothesis}</span>
          </p>
          <p>
            <span lang="en">{record.decisionSummary}</span>
          </p>
          <p>
            {t('Reasoning: ')}
            <span lang="en">{record.reasoning}</span>
          </p>
          <ul>
            {record.evidenceInspected.map((evidence, index) => (
              <li key={index}>
                <a href={`/${evidence.artifact.path}`}>
                  {evidence.artifact.path}
                </a>
                : <span lang="en">{evidence.finding}</span>
              </li>
            ))}
          </ul>
          <p>{t('Source locations:')}</p>
          <ul>
            {record.sourceLocations.map((location, index) => (
              <li key={index}>
                <code>
                  {location.path}:{location.startLine}–{location.endLine}
                </code>{' '}
                {t('at ')}
                {location.revision}
              </li>
            ))}
          </ul>
          <Reference label={t('Related diff')} value={record.relatedDiff} />
          <Reference
            label={t('Before measurement')}
            value={record.measurements.before}
          />
          <Reference
            label={t('After measurement')}
            value={record.measurements.after}
          />
          <p>
            {t('Measurement conditions:')}{' '}
            {typeof record.measurements.conditions === 'string'
              ? record.measurements.conditions
              : record.measurements.conditions.reason}
          </p>
          <p>
            {t('Reviewed by ')}
            {record.verification?.reviewer}
            {t(' at')} {record.verification?.verifiedAt}
          </p>
        </article>
      ))}
    </section>
  );
}
