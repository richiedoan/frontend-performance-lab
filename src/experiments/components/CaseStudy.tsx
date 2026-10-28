'use client';
import { useTranslation } from '../../i18n/useTranslation';
import { useEffect, useState } from 'react';
import { InvestigationLog } from './InvestigationLog';
import type { Investigation } from '../data/types/investigation';
import type { CaseStudyView } from '../data/summaries/case-study';
import type { MeasuredValue, MissingResult } from '../data/types/experiment';
import styles from './case-study.module.css';
type State =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      records: CaseStudyView;
      investigations: Investigation[];
    };
function Result({ value }: { value: MeasuredValue | MissingResult }) {
  const t = useTranslation();

  if (value.status === 'not-available')
    return (
      <span>
        {t('Not available: ')}
        {t.text(value.reason)}
      </span>
    );
  return (
    <>
      <strong>
        {value.value.toLocaleString(t.locale, { maximumFractionDigits: 3 })}{' '}
        {value.unit}
      </strong>
      <br />
      {t('Median · ')}
      {value.sampleCount}
      {t(' samples')}
      <br />
      <a href={`/${value.evidencePath}`}>
        {t('Evidence: ')}
        {value.evidencePath}
      </a>
      <p>
        {t('Extraction: ')}
        {value.extraction}
      </p>
    </>
  );
}
export function CaseStudy() {
  const t = useTranslation();

  const [state, setState] = useState<State>({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/case-study', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Invalid records');
        const data = await response.json();
        if (!Array.isArray(data.records)) throw new Error('Invalid response');
        if (!controller.signal.aborted)
          setState({
            status: 'ready',
            records: data.records,
            investigations: Array.isArray(data.investigations)
              ? data.investigations
              : [],
          });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [revision]);
  return (
    <main className={styles.page}>
      <h1>{t('Case Study')}</h1>
      <p>
        {t(
          'Purpose, approaches and evidence for isolated frontend experiments. Values are read from validated run records.',
        )}
      </p>
      <p>
        {t(
          'Field interaction data is not available without RUM evidence. Lab timing is not a field interaction metric.',
        )}
      </p>
      {state.status === 'loading' && (
        <p role="status">{t('Loading experiment records…')}</p>
      )}
      {state.status === 'error' && (
        <div role="alert">
          <p>{t('Experiment records could not be loaded or validated.')}</p>
          <button
            type="button"
            onClick={() => {
              setState({ status: 'loading' });
              setRevision((value) => value + 1);
            }}
          >
            {t('Retry')}
          </button>
        </div>
      )}
      {state.status === 'ready' && (
        <>
          {!state.records.length && (
            <p role="status">{t('No experiment records available.')}</p>
          )}
          <nav aria-label={t('Experiments')}>
            <ul>
              {state.records.map((record) => (
                <li key={record.id}>
                  <a href={`#experiment-${record.id}`}>
                    {t.text(record.title)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          {state.records.map((record) => (
            <section
              key={record.id}
              id={`experiment-${record.id}`}
              aria-labelledby={`heading-${record.id}`}
              className={styles.experiment}
            >
              <h2 id={`heading-${record.id}`}>{t.text(record.title)}</h2>
              <p>{t.text(record.purpose)}</p>
              <p>
                {t('Primary variable: ')}
                {t.text(record.variable)}
              </p>
              <dl className={styles.approaches}>
                {record.approaches.map((approach) => (
                  <div key={approach.id} data-approach={approach.id}>
                    <dt>{t.text(approach.id)}</dt>
                    <dd>{t.text(approach.description)}</dd>
                  </div>
                ))}
              </dl>
              {!record.runs.length && (
                <p role="status">{t('No runs available.')}</p>
              )}
              {record.runs.map((run) => (
                <article key={run.id} aria-labelledby={`run-${run.id}`}>
                  <h3 id={`run-${run.id}`}>
                    {t('Run: ')}
                    {run.id}
                  </h3>
                  {run.reason && (
                    <p role="status">
                      {t('Not available: ')}
                      {t.text(run.reason)}
                    </p>
                  )}
                  <details>
                    <summary>{t('Environment and provenance')}</summary>
                    {'status' in run.environment ? (
                      <p>
                        {t('Not available: ')}
                        {t.text(run.environment.reason)}
                      </p>
                    ) : (
                      <dl className={styles.environment}>
                        {Object.entries(run.environment).map(([key, value]) => (
                          <div key={key}>
                            <dt>{key}</dt>
                            <dd>
                              {typeof value === 'object'
                                ? JSON.stringify(value)
                                : String(value)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </details>
                  {run.metrics.map((metric) => (
                    <section
                      key={metric.id}
                      aria-label={t.text(metric.id)}
                      className={styles.metric}
                    >
                      <h4>
                        {metric.id === 'journey-duration'
                          ? t('Journey duration')
                          : t.text(metric.id)}
                      </h4>
                      {metric.id === 'journey-duration' && (
                        <p>
                          {t(
                            'Dashboard → Detail → Dashboard, including automation and network waits. This is not INP, LCP or algorithm-only time.',
                          )}
                        </p>
                      )}
                      <div
                        className={styles.tableWrap}
                        tabIndex={0}
                        role="region"
                        aria-label={t('{metric} results', {
                          metric: t.text(metric.id),
                        })}
                      >
                        <table>
                          <caption>
                            {metric.id === 'journey-duration'
                              ? t('Journey duration')
                              : t.text(metric.id)}{' '}
                            — {metric.unit}
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col">{t('Approach')}</th>
                              <th scope="col">{t('Result and evidence')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <th scope="row">{t('Baseline')}</th>
                              <td>
                                <Result value={metric.baseline} />
                              </td>
                            </tr>
                            <tr>
                              <th scope="row">{t('Optimized')}</th>
                              <td>
                                <Result value={metric.optimized} />
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      {metric.group &&
                        metric.baseline.status === 'measured' &&
                        metric.optimized.status === 'measured' && (
                          <figure
                            aria-label={`${t.text(metric.group)}: ${metric.id}`}
                          >
                            <figcaption>
                              {t.text(metric.group)}: {metric.id}
                              {t(' (median, ')}
                              {metric.unit})
                            </figcaption>
                            {(['baseline', 'optimized'] as const).map(
                              (approach) => {
                                const value = metric[approach] as MeasuredValue;
                                const max = Math.max(
                                  (metric.baseline as MeasuredValue).value,
                                  (metric.optimized as MeasuredValue).value,
                                  1,
                                );
                                return (
                                  <div key={approach} className={styles.barRow}>
                                    <span>{t.text(approach)}</span>
                                    <span
                                      className={styles.barTrack}
                                      aria-hidden="true"
                                    >
                                      <span
                                        style={{
                                          width: `${(value.value / max) * 100}%`,
                                        }}
                                      />
                                    </span>
                                    <span>
                                      {value.value.toLocaleString(t.locale)}{' '}
                                      {value.unit}
                                    </span>
                                  </div>
                                );
                              },
                            )}
                          </figure>
                        )}
                      {metric.comparison !== null && (
                        <p>
                          {Math.abs(metric.comparison).toLocaleString(
                            t.locale,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                              useGrouping: false,
                            },
                          )}
                          % {metric.comparison >= 0 ? t('lower') : t('higher')}
                          {t(' than baseline.')}
                        </p>
                      )}
                      <p className={styles.limitation}>
                        {t.text(metric.limitation)}
                      </p>
                    </section>
                  ))}
                </article>
              ))}
            </section>
          ))}
          <InvestigationLog records={state.investigations} />
          <aside aria-label={t('Limitations')}>
            <h2>{t('Limitations')}</h2>
            <p>
              {t(
                'Charts compare compatible results within one run only. Raw file integrity and accessibility are checked; this does not independently establish extraction accuracy or statistical significance. Diagnostic artifacts are not automatically promoted into published run records.',
              )}
            </p>
          </aside>
        </>
      )}
    </main>
  );
}
