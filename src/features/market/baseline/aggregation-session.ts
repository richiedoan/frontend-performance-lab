import { aggregateMarkets } from '../worker-aggregation/aggregate';
import type {
  AggregationFactory,
  JobEvent,
} from '../worker-aggregation/protocol';
export const createBaselineAggregation: AggregationFactory = (publish) => {
  let version = 0;
  let disposed = false;
  const events: JobEvent[] = [];
  return {
    update(input) {
      if (disposed) return;
      const current = ++version;
      const startedAt = performance.now();
      publish({
        input,
        state: { status: 'running', version: current, startedAt },
        events: [...events],
        startedCount: version,
        cancelledCount: 0,
      });
      try {
        const output = aggregateMarkets(input);
        events.push({
          version: current,
          startedAt,
          endedAt: performance.now(),
          outcome: 'completed',
        });
        if (events.length > 50) events.shift();
        publish({
          input,
          state: { status: 'success', version: current, output },
          events: [...events],
          startedCount: version,
          cancelledCount: 0,
        });
      } catch (error) {
        events.push({
          version: current,
          startedAt,
          endedAt: performance.now(),
          outcome: 'error',
        });
        if (events.length > 50) events.shift();
        publish({
          input,
          state: {
            status: 'error',
            version: current,
            message:
              error instanceof Error ? error.message : 'Aggregation failed',
          },
          events: [...events],
          startedCount: version,
          cancelledCount: 0,
        });
      }
    },
    dispose() {
      disposed = true;
    },
  };
};
