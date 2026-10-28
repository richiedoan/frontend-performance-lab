import { aggregateMarkets } from './aggregate';
import type { AggregationJob, AggregationReply } from './protocol';
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<AggregationJob>) => void) | null;
  postMessage: (reply: AggregationReply) => void;
};
scope.onmessage = ({ data }) => {
  try {
    scope.postMessage({
      version: data.version,
      status: 'success',
      output: aggregateMarkets(data.input),
    });
  } catch (error) {
    scope.postMessage({
      version: data.version,
      status: 'error',
      message: error instanceof Error ? error.message : 'Aggregation failed',
    });
  }
};
