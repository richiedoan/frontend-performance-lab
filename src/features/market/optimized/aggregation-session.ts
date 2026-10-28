import type { AggregationInput } from '../worker-aggregation/aggregate';
import type {
  AggregationFactory,
  AggregationSnapshot,
  JobEvent,
  WorkerPort,
} from '../worker-aggregation/protocol';
function browserWorker(): WorkerPort {
  return new Worker(
    new URL('../worker-aggregation/aggregation.worker.ts', import.meta.url),
    { type: 'module' },
  );
}
export function createOptimizedAggregation(
  publish: Parameters<AggregationFactory>[0],
  createWorker: () => WorkerPort = browserWorker,
): ReturnType<AggregationFactory> {
  let version = 0;
  let latestInput: AggregationInput;
  let disposed = false;
  let active: {
    worker: WorkerPort;
    version: number;
    startedAt: number;
  } | null = null;
  let cancelledCount = 0;
  const events: JobEvent[] = [];
  function release(outcome: JobEvent['outcome']) {
    if (!active) return;
    const { worker, version, startedAt } = active;
    active = null;
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
    if (outcome === 'cancelled') cancelledCount++;
    events.push({ version, startedAt, endedAt: performance.now(), outcome });
    if (events.length > 50) events.shift();
  }
  function emit(state: AggregationSnapshot['state']) {
    if (!disposed)
      publish({
        input: latestInput,
        state,
        events: [...events],
        startedCount: version,
        cancelledCount,
      });
  }
  return {
    update(input) {
      if (disposed) return;
      release('cancelled');
      latestInput = input;
      const current = ++version;
      const startedAt = performance.now();
      emit({ status: 'running', version: current, startedAt });
      try {
        const worker = createWorker();
        active = { worker, version: current, startedAt };
        worker.onmessage = ({ data }) => {
          if (
            disposed ||
            active?.version !== current ||
            data.version !== current
          )
            return;
          release(data.status === 'success' ? 'completed' : 'error');
          emit(
            data.status === 'success'
              ? { status: 'success', version: current, output: data.output }
              : { status: 'error', version: current, message: data.message },
          );
        };
        worker.onerror = () => {
          if (disposed || active?.version !== current) return;
          release('error');
          emit({
            status: 'error',
            version: current,
            message: 'Worker aggregation failed. Retry the job.',
          });
        };
        worker.postMessage({ version: current, input });
      } catch (error) {
        if (active) release('error');
        else
          events.push({
            version: current,
            startedAt,
            endedAt: performance.now(),
            outcome: 'error',
          });
        if (events.length > 50) events.shift();
        emit({
          status: 'error',
          version: current,
          message:
            error instanceof Error ? error.message : 'Unable to start Worker',
        });
      }
    },
    dispose() {
      release('cancelled');
      disposed = true;
    },
  };
}
