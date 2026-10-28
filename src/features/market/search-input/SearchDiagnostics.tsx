'use client';
import { useTranslation } from '../../../i18n/useTranslation';
import type { SearchStats } from './types';
export function SearchDiagnostics({ stats }: { stats?: SearchStats }) {
  const t = useTranslation();

  return (
    <details
      data-testid="search-diagnostics"
      data-request-count={stats?.requestCount ?? 0}
      data-calculation-count={stats?.calculationCount ?? 0}
      data-aborted-count={stats?.abortedCount ?? 0}
      data-stale-count={stats?.staleCount ?? 0}
    >
      <summary>{t('Search experiment diagnostics')}</summary>
      <p>
        {t(
          'Logical mock requests; timestamps are performance.now() milliseconds. Last 100 completions; no benchmark claim.',
        )}
      </p>
      <pre className="search-completions" data-testid="search-completions">
        {JSON.stringify(stats?.completions ?? [])}
      </pre>
    </details>
  );
}
