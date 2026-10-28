import { describe, expect, it } from 'vitest';
import { parseExperimentDefinition, parseExperimentRun } from './experiment';
import {
  buildExperimentRegistry,
  getExperimentRegistry,
} from '../catalog/registry';
import {
  getCaseStudyRecords,
  readCaseStudyRun,
} from '../catalog/case-study-records';
import type { ExperimentRun } from '../types/experiment';

const definition = getExperimentRegistry()[0].definition;
// Synthetic validator fixture only. Never imported by the registry or case study.
function fixture(): ExperimentRun {
  return {
    schemaVersion: 1,
    id: 'test-only',
    experimentId: definition.id,
    status: 'recorded',
    reason: null,
    environment: {
      sourceRevision: 'test-revision',
      dirtyPatch: {
        status: 'not-available',
        reason: 'Clean fixture checkout.',
      },
      lockfileSha256: 'a'.repeat(64),
      buildId: 'test-build',
      nodeVersion: '24.19.0',
      packageManager: { name: 'yarn', version: '1.22.22' },
      browser: 'Chromium',
      browserVersion: 'test',
      os: 'test',
      cpu: 'test',
      memoryBytes: 1024,
      viewport: { width: 390, height: 844 },
      cpuThrottle: 4,
      network: 'test',
      cache: 'cold',
      reducedMotion: true,
      dataset: {
        seed: 20260911,
        count: 5000,
        generatorVersion: 1,
        schemaVersion: 1,
        sha256: 'b'.repeat(64),
      },
      command: 'test-only',
    },
    artifacts: [
      {
        path: 'evidence/test-only/raw.json',
        kind: 'log',
        sha256: 'c'.repeat(64),
        collectedAt: '2026-09-12T00:00:00.000Z',
      },
    ],
    results: [
      {
        approach: 'baseline',
        metricId: 'dom-nodes',
        result: {
          status: 'measured',
          value: 12,
          unit: 'count',
          aggregation: 'median',
          sampleCount: 5,
          evidencePath: 'evidence/test-only/raw.json',
          extraction: 'Test-only extraction procedure.',
        },
      },
      {
        approach: 'optimized',
        metricId: 'dom-nodes',
        result: { status: 'not-available', reason: 'Not collected.' },
      },
    ],
  };
}

describe('experiment records', () => {
  it('accepts valid definitions and measured schema fixtures without mutating input', () => {
    expect(parseExperimentDefinition(definition)).toEqual(definition);
    const input = fixture();
    expect(parseExperimentRun(input, definition)).toEqual(input);
    expect(
      readCaseStudyRun(input, definition, () => true).results[0].result.status,
    ).toBe('measured');
    readCaseStudyRun(input, definition);
    expect(input.results[0].result.status).toBe('measured');
  });
  it('registers all planned experiments with only unavailable values and no fake evidence', () => {
    const registry = getCaseStudyRecords();
    expect(registry).toHaveLength(10);
    for (const { runs } of registry)
      for (const run of runs) {
        expect(run.status).toBe('not-available');
        expect(run.artifacts).toEqual([]);
        expect(run.results).toHaveLength(2);
        for (const { result } of run.results)
          expect(result).toEqual({
            status: 'not-available',
            reason: expect.stringMatching(/No benchmark/),
          });
      }
  });
  it.each([NaN, Infinity, -1])('rejects invalid measured value %s', (value) => {
    const input = fixture();
    if (input.results[0].result.status === 'measured')
      input.results[0].result.value = value;
    expect(() => parseExperimentRun(input, definition)).toThrow();
  });
  it.each([0, -1, 1.5])('rejects invalid sample count %s', (count) => {
    const input = fixture();
    if (input.results[0].result.status === 'measured')
      input.results[0].result.sampleCount = count;
    expect(() => parseExperimentRun(input, definition)).toThrow();
  });
  it('rejects absent evidence, incorrect unit, missing fields, unknown metric and mismatched experiment', () => {
    const input = fixture();
    expect(() =>
      parseExperimentRun({ ...input, artifacts: [] }, definition),
    ).toThrow(/evidencePath/);
    expect(() =>
      parseExperimentRun({ ...input, experimentId: 'unknown' }, definition),
    ).toThrow();
    expect(() =>
      parseExperimentRun({ ...input, results: [] }, definition),
    ).toThrow();
    const result = input.results[0].result;
    for (const change of [
      { unit: 'ms' },
      { metricId: 'unknown' },
      { value: undefined },
      { evidencePath: 'evidence/../secret' },
      { aggregation: 'invented' },
      { extraction: '' },
    ]) {
      const changed =
        'metricId' in change
          ? { ...input.results[0], ...change }
          : { ...input.results[0], result: { ...result, ...change } };
      expect(() =>
        parseExperimentRun(
          { ...input, results: [changed, input.results[1]] },
          definition,
        ),
      ).toThrow();
    }
  });
  it('rejects invalid environment, checksums, dates, duplicates and empty unavailable reason', () => {
    const input = fixture();
    expect(() =>
      parseExperimentRun({ ...input, environment: {} }, definition),
    ).toThrow();
    expect(() =>
      parseExperimentRun(
        { ...input, artifacts: [input.artifacts[0], input.artifacts[0]] },
        definition,
      ),
    ).toThrow();
    for (const change of [
      { sha256: 'invalid' },
      { collectedAt: 'yesterday' },
      { kind: 'screenshot' },
    ])
      expect(() =>
        parseExperimentRun(
          { ...input, artifacts: [{ ...input.artifacts[0], ...change }] },
          definition,
        ),
      ).toThrow();
    expect(() =>
      parseExperimentRun(
        {
          ...input,
          results: [
            input.results[0],
            {
              ...input.results[1],
              result: { status: 'not-available', reason: ' ' },
            },
          ],
        },
        definition,
      ),
    ).toThrow();
    expect(() =>
      parseExperimentDefinition({
        ...definition,
        approaches: [definition.approaches[0], definition.approaches[0]],
      }),
    ).toThrow();
  });
  it('keeps unverified, unreadable or undersampled evidence unavailable to case study', () => {
    expect(
      readCaseStudyRun(fixture(), definition).results[0].result,
    ).toMatchObject({
      status: 'not-available',
      reason: 'Raw evidence has not been verified.',
    });
    expect(
      readCaseStudyRun(fixture(), definition, () => {
        throw new Error('Missing file');
      }).results[0].result.status,
    ).toBe('not-available');
    const input = fixture();
    if (input.results[0].result.status === 'measured')
      input.results[0].result.sampleCount = 4;
    expect(
      readCaseStudyRun(input, definition, () => true).results[0].result,
    ).toMatchObject({
      status: 'not-available',
      reason: expect.stringMatching(/five/),
    });
  });
});

it('rejects duplicate registry identities and orphan runs', () => {
  const run = fixture();
  expect(() =>
    buildExperimentRegistry([definition, definition], [run]),
  ).toThrow('Duplicate experiment ID');
  expect(() => buildExperimentRegistry([definition], [run, run])).toThrow(
    'Duplicate run ID',
  );
  expect(() =>
    buildExperimentRegistry(
      [definition],
      [{ ...run, experimentId: 'unknown' }],
    ),
  ).toThrow('Unknown experiment ID');
});
