import type { AggregationInput, AggregationOutput } from './aggregate';
export interface AggregationJob {
  version: number;
  input: AggregationInput;
}
export type AggregationReply =
  | { version: number; status: 'success'; output: AggregationOutput }
  | { version: number; status: 'error'; message: string };
export interface WorkerPort {
  onmessage: ((event: MessageEvent<AggregationReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage: (job: AggregationJob) => void;
  terminate: () => void;
}
export interface JobEvent {
  version: number;
  startedAt: number;
  endedAt: number;
  outcome: 'completed' | 'cancelled' | 'error';
}
export type JobState =
  | { status: 'running'; version: number; startedAt: number }
  | { status: 'success'; version: number; output: AggregationOutput }
  | { status: 'error'; version: number; message: string };
export interface AggregationSnapshot {
  input: AggregationInput;
  state: JobState;
  events: JobEvent[];
  startedCount: number;
  cancelledCount: number;
}
export interface AggregationSession {
  update: (input: AggregationInput) => void;
  dispose: () => void;
}
export type AggregationFactory = (
  publish: (snapshot: AggregationSnapshot) => void,
) => AggregationSession;
