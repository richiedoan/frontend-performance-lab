import {
  requestSearch,
  SEARCH_DEBOUNCE_MS,
} from '../search-input/search-request';
import type { SearchRequest } from '../search-input/search-request';
import type {
  SearchFactory,
  SearchSnapshot,
  SearchStats,
} from '../search-input/types';

/** Debounce and cancel obsolete requests; ID guard also handles non-cooperative services. */
export function createOptimizedSearch(
  publish: Parameters<SearchFactory>[0],
  request: SearchRequest = requestSearch,
  now: () => number = () => performance.now(),
): ReturnType<SearchFactory> {
  let disposed = false;
  let generation = 0;
  const controllers = new Set<AbortController>();
  let snapshot: SearchSnapshot;
  const stats: SearchStats = {
    requestCount: 0,
    calculationCount: 0,
    abortedCount: 0,
    staleCount: 0,
    completions: [],
  };
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let active: AbortController | undefined;
  function emit() {
    if (!disposed)
      publish({
        ...snapshot,
        stats: { ...stats, completions: [...stats.completions] },
      });
  }
  return {
    update(records, query) {
      if (disposed) return;
      const version = ++generation;
      const input = structuredClone(query);
      snapshot = {
        source: records,
        queryKey: JSON.stringify(query),
        state: { status: 'loading' },
        stats,
      };
      emit();
      function start() {
        const controller = new AbortController();
        active = controller;
        controllers.add(controller);
        const requestId = ++stats.requestCount;
        const startedAt = now();
        function finish(outcome: 'applied' | 'stale' | 'aborted' | 'error') {
          controllers.delete(controller);
          if (outcome === 'aborted') stats.abortedCount++;
          if (outcome === 'stale') stats.staleCount++;
          stats.completions.push({
            requestId,
            query: input.search,
            startedAt,
            completedAt: now(),
            outcome,
          });
          // Retain only recent diagnostics; aggregate counts remain exact for this dataset lifecycle.
          stats.completions = stats.completions.slice(-100);
          emit();
        }
        request(records, input, controller.signal, () => {
          stats.calculationCount++;
        })
          .then((result) => {
            if (disposed) return;
            if (controller.signal.aborted) {
              finish('aborted');
              return;
            }
            if (version !== generation) {
              finish('stale');
              return;
            }
            snapshot = {
              ...snapshot,
              state: { status: 'success', records: result },
            };
            finish('applied');
          })
          .catch((error: unknown) => {
            if (disposed) return;
            if (controller.signal.aborted) {
              finish('aborted');
              return;
            }
            if (version !== generation) {
              finish('stale');
              return;
            }
            snapshot = {
              ...snapshot,
              state: {
                status: 'error',
                message:
                  error instanceof Error
                    ? error.message
                    : 'Search failed. Please retry.',
              },
            };
            finish('error');
          });
        emit();
      }
      if (debounce !== undefined) clearTimeout(debounce);
      active?.abort();
      debounce = setTimeout(start, SEARCH_DEBOUNCE_MS);
    },
    dispose() {
      disposed = true;
      generation++;
      if (debounce !== undefined) clearTimeout(debounce);
      for (const controller of controllers) controller.abort();
      controllers.clear();
    },
  };
}
