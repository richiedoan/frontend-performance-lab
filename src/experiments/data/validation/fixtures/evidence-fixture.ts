import type { ExperimentRun } from '../../types/experiment';

/** Synthetic test metadata only; never registered as a real experiment run. */
export function measuredFixture(
  id: string,
  artifactSha256: string,
): ExperimentRun {
  return {
    schemaVersion: 1,
    id,
    experimentId: 'large-list',
    status: 'recorded',
    reason: null,
    environment: {
      sourceRevision: 'test-only-revision',
      dirtyPatch: { status: 'not-available', reason: 'Clean test fixture.' },
      lockfileSha256: 'a'.repeat(64),
      buildId: 'test-only-build',
      nodeVersion: '24.19.0',
      packageManager: { name: 'yarn', version: '1.22.22' },
      browser: 'test-browser',
      browserVersion: '1',
      os: 'test-os',
      cpu: 'test-cpu',
      memoryBytes: 1024,
      viewport: { width: 390, height: 844 },
      cpuThrottle: 1,
      network: 'test-network',
      cache: 'cold',
      reducedMotion: true,
      dataset: {
        seed: 20260911,
        count: 5000,
        generatorVersion: 1,
        schemaVersion: 1,
        sha256: 'b'.repeat(64),
      },
      command: 'fixture-only',
    },
    artifacts: [
      {
        path: `evidence/large-list/${id}/samples.json`,
        kind: 'log',
        sha256: artifactSha256,
        collectedAt: '2026-09-12T00:00:00.000Z',
      },
    ],
    results: [
      {
        approach: 'baseline',
        metricId: 'dom-nodes',
        result: {
          status: 'measured',
          value: 10,
          unit: 'count',
          aggregation: 'median',
          sampleCount: 5,
          evidencePath: `evidence/large-list/${id}/samples.json`,
          extraction: 'Test-only median of samples array.',
        },
      },
      {
        approach: 'optimized',
        metricId: 'dom-nodes',
        result: {
          status: 'not-available',
          reason: 'No optimized fixture measurements.',
        },
      },
    ],
  };
}
