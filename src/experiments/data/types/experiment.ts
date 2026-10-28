export type ApproachId = 'baseline' | 'optimized';
export interface Approach {
  id: ApproachId;
  description: string;
}
export type Unit = 'ms' | 'bytes' | 'count' | 'score';
export type Aggregation = 'single' | 'median' | 'mean' | 'p95' | 'sum';
export interface MissingResult {
  status: 'not-available';
  reason: string;
}
export interface MeasuredValue {
  status: 'measured';
  value: number;
  unit: Unit;
  aggregation: Aggregation;
  sampleCount: number;
  evidencePath: string;
  extraction: string;
}
export interface Artifact {
  path: string;
  kind: 'trace' | 'profile' | 'log' | 'screenshot';
  sha256: string;
  collectedAt: string;
}
export interface Environment {
  sourceRevision: string;
  dirtyPatch: string | MissingResult;
  lockfileSha256: string;
  buildId: string;
  nodeVersion: string;
  packageManager: { name: 'yarn'; version: string };
  browser: string;
  browserVersion: string;
  os: string;
  cpu: string;
  memoryBytes: number;
  viewport: { width: number; height: number };
  cpuThrottle: number;
  network: string;
  cache: 'cold' | 'warm';
  reducedMotion: boolean;
  dataset: {
    seed: number;
    count: number;
    generatorVersion: number;
    schemaVersion: number;
    sha256: string;
  };
  command: string;
}
export interface ExperimentDefinition {
  id: string;
  title: string;
  hypothesis: string;
  primaryVariable: string;
  approaches: [Approach, Approach];
  metrics: { id: string; unit: Unit }[];
}
export interface ExperimentRun {
  schemaVersion: 1;
  id: string;
  experimentId: string;
  status: 'recorded' | 'not-available';
  reason: string | null;
  environment: Environment | MissingResult;
  artifacts: Artifact[];
  results: {
    approach: ApproachId;
    metricId: string;
    result: MeasuredValue | MissingResult;
  }[];
}
