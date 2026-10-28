import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AggregationExperiment } from './AggregationExperiment';
import { aggregateMarkets } from './aggregate';
import { createOptimizedAggregation } from '../optimized/aggregation-session';
import { generateMarketRecords } from '../data/generate-market-records';
import { DEFAULT_MARKET_QUERY } from '../domain/market-query';
import type {
  AggregationFactory,
  AggregationJob,
  AggregationReply,
  WorkerPort,
} from './protocol';
it('cleans StrictMode workers, cancels invalid input, and ignores messages after unmount', () => {
  const workers: WorkerPort[] = [];
  const factory: AggregationFactory = (publish) =>
    createOptimizedAggregation(publish, () => {
      const worker: WorkerPort = {
        onmessage: null,
        onerror: null,
        postMessage: vi.fn(),
        terminate: vi.fn(),
      };
      workers.push(worker);
      return worker;
    });
  const records = generateMarketRecords({ seed: 20260911, count: 3 });
  const view = render(
    <StrictMode>
      <AggregationExperiment
        records={records}
        query={DEFAULT_MARKET_QUERY}
        initialPasses={2}
        factory={factory}
      />
    </StrictMode>,
  );
  expect(workers).toHaveLength(2);
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  const job = vi.mocked(workers[1].postMessage).mock
    .calls[0][0] as AggregationJob;
  act(() =>
    workers[1].onmessage?.({
      data: {
        version: job.version,
        status: 'success',
        output: aggregateMarkets(job.input),
      },
    } as MessageEvent<AggregationReply>),
  );
  expect(screen.getByTestId('aggregation-output')).toHaveTextContent(
    JSON.stringify(aggregateMarkets(job.input)),
  );
  fireEvent.change(screen.getByTestId('aggregation-passes'), {
    target: { value: '3' },
  });
  const latest = workers[2];
  const queued = latest.onmessage!;
  fireEvent.change(screen.getByTestId('aggregation-passes'), {
    target: { value: '101' },
  });
  expect(latest.terminate).toHaveBeenCalledOnce();
  expect(screen.getByRole('alert')).toHaveTextContent('1 to 100');
  expect(screen.queryByTestId('aggregation-output')).not.toBeInTheDocument();
  view.unmount();
  act(() =>
    queued({
      data: {
        version: 2,
        status: 'success',
        output: aggregateMarkets(job.input),
      },
    } as MessageEvent<AggregationReply>),
  );
  expect(screen.queryByTestId('aggregation-output')).not.toBeInTheDocument();
});
