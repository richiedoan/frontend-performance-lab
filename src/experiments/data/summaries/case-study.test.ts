import { expect, it } from 'vitest';
import { summarizeCaseStudy } from './case-study';
import { readCaseStudyRun } from '../catalog/case-study-records';
import { plannedDefinitions } from '../definitions/planned';
import { measuredFixture } from '../validation/fixtures/evidence-fixture';
function setup(metric = 'dom-nodes', extraction = 'fixture') {
  const definition = {
    ...plannedDefinitions[0],
    metrics: [
      {
        id: metric,
        unit: metric === 'cls' ? ('score' as const) : ('count' as const),
      },
    ],
  };
  const input = measuredFixture('fixture', 'a'.repeat(64));
  const baseline = input.results[0].result;
  if (baseline.status !== 'measured') throw new Error('Fixture');
  baseline.extraction = extraction;
  baseline.unit = definition.metrics[0].unit;
  input.results = [
    { approach: 'baseline', metricId: metric, result: baseline },
    {
      approach: 'optimized',
      metricId: metric,
      result: { ...baseline, value: 5 },
    },
  ];
  return { definition, input };
}
it('derives comparison, five-sample medians and runtime chart from verified records', () => {
  const { definition, input } = setup();
  const view = summarizeCaseStudy([
    { definition, runs: [readCaseStudyRun(input, definition, () => true)] },
  ]);
  expect(view[0].runs[0].metrics[0]).toMatchObject({
    compatible: true,
    comparison: 50,
    group: 'Runtime — lab',
  });
});
it('withholds comparisons and charts for partial/unverified or mismatched extraction', () => {
  const { definition, input } = setup();
  const unverified = readCaseStudyRun(input, definition);
  expect(
    summarizeCaseStudy([{ definition, runs: [unverified] }])[0].runs[0]
      .metrics[0],
  ).toMatchObject({ compatible: false, comparison: null, group: null });
  const opt = input.results[1].result;
  if (opt.status === 'measured') opt.extraction = 'different';
  expect(
    summarizeCaseStudy([
      { definition, runs: [readCaseStudyRun(input, definition, () => true)] },
    ])[0].runs[0].metrics[0].comparison,
  ).toBeNull();
});
it('does not pair different environments across separate partial runs', () => {
  const { definition, input } = setup();
  const second = structuredClone(input);
  second.id = 'second';
  input.results[1].result = {
    status: 'not-available',
    reason: 'missing optimized',
  };
  second.results[0].result = {
    status: 'not-available',
    reason: 'missing baseline',
  };
  if (!('status' in second.environment))
    second.environment.cpu = 'other machine';
  const view = summarizeCaseStudy([
    {
      definition,
      runs: [input, second].map((run) =>
        readCaseStudyRun(run, definition, () => true),
      ),
    },
  ]);
  expect(view[0].runs.every((run) => run.metrics[0].comparison === null)).toBe(
    true,
  );
});
it('rejects units, hides INP and requires explicit repeated-navigation extraction for memory charts', () => {
  const { definition, input } = setup();
  const opt = input.results[1].result;
  if (opt.status === 'measured') opt.unit = 'bytes';
  expect(() => readCaseStudyRun(input, definition, () => true)).toThrow();
  for (const [metric, extraction, group] of [
    ['inp', 'field-unknown', null],
    ['detached-nodes', 'drawer-only', null],
    ['detached-nodes', 'repeated-navigation/v1', 'Repeated-navigation memory'],
    ['cls', 'lighthouse/v1', 'Core Web Vitals — lab'],
  ]) {
    const s = setup(metric!, extraction!);
    const v = summarizeCaseStudy([
      {
        definition: s.definition,
        runs: [readCaseStudyRun(s.input, s.definition, () => true)],
      },
    ])[0].runs[0].metrics;
    if (metric === 'inp') expect(v).toEqual([]);
    else expect(v[0].group).toBe(group);
  }
});
it('does not divide by zero or publish non-five-sample measurements', () => {
  const { definition, input } = setup();
  const base = input.results[0].result;
  if (base.status === 'measured') base.value = 0;
  expect(
    summarizeCaseStudy([
      { definition, runs: [readCaseStudyRun(input, definition, () => true)] },
    ])[0].runs[0].metrics[0].comparison,
  ).toBeNull();
  if (base.status === 'measured') base.sampleCount = 4;
  expect(
    readCaseStudyRun(input, definition, () => true).results[0].result.status,
  ).toBe('not-available');
});
