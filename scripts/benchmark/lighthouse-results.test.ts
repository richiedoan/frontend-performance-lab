// @vitest-environment node
import { it, expect } from 'vitest';
import {
  lighthouseThrottling,
  aggregateLighthouse,
  fieldInp,
  lighthouseVersion,
  metricAudits,
  parseLighthouse,
} from './lighthouse-results';
import {
  collectLighthouse,
  lighthouseLaunchArgs,
} from './lighthouse-collector';
import type { EnvironmentArtifact } from './environment';
const url = 'http://fixture.invalid/baseline';
it.each([
  ['linux', 0, true],
  ['linux', 1000, false],
  ['darwin', 0, false],
  ['win32', undefined, false],
] as const)(
  'configures Chrome sandbox for %s uid %s',
  (platform, uid, disabled) => {
    const args = lighthouseLaunchArgs(platform, uid);
    expect(args).toContain('--lang=en-US');
    expect(args.includes('--no-sandbox')).toBe(disabled);
  },
);
// Synthetic parser fixture only. Never copied into artifacts or registry.
function fixture() {
  return {
    lighthouseVersion,
    requestedUrl: url,
    finalDisplayedUrl: url,
    fetchTime: '2026-09-12T00:00:00Z',
    configSettings: {
      throttlingMethod: 'devtools',
      throttling: { ...lighthouseThrottling },
      disableStorageReset: true,
      screenEmulation: { disabled: true },
      emulatedUserAgent: false,
    },
    audits: Object.fromEntries(
      Object.values(metricAudits).map(([id, unit]) => [
        id,
        { numericValue: 4, numericUnit: unit },
      ]),
    ),
  };
}
it('parses all six metrics with evidence, units and unavailable field INP', () => {
  const result = parseLighthouse(fixture(), url, 'baseline-1-lighthouse.json');
  expect(Object.keys(result)).toHaveLength(6);
  expect(result.transferSize).toMatchObject({
    status: 'measured',
    unit: 'bytes',
    sampleCount: 1,
    evidencePaths: ['baseline-1-lighthouse.json'],
  });
  expect(result.cls).toMatchObject({ unit: 'unitless' });
  expect(fieldInp).toMatchObject({
    status: 'not-available',
    reason: expect.stringContaining('No RUM'),
  });
});
it('rejects wrong version, runtime error, URL, path and environment policy', () => {
  for (const changes of [
    { lighthouseVersion: '0' },
    { runtimeError: { code: 'NO_FCP' } },
    { finalDisplayedUrl: 'http://wrong' },
    { configSettings: { throttlingMethod: 'simulate' } },
    { fetchTime: 'bad' },
  ])
    expect(() =>
      parseLighthouse(
        { ...fixture(), ...changes },
        url,
        'baseline-1-lighthouse.json',
      ),
    ).toThrow();
  expect(() => parseLighthouse(fixture(), url, '../report.json')).toThrow();
  expect(() =>
    parseLighthouse(null, url, 'baseline-1-lighthouse.json'),
  ).toThrow();
});
it('does not convert missing, wrong-unit or errored audits into zero', () => {
  for (const audit of [
    undefined,
    { numericValue: -1 },
    { numericValue: NaN, numericUnit: 'millisecond' },
    { numericValue: 4, numericUnit: 'bytes' },
    { numericValue: 4, numericUnit: 'millisecond', scoreDisplayMode: 'error' },
  ]) {
    const report = fixture();
    Object.assign(report.audits, { 'largest-contentful-paint': audit });
    expect(
      parseLighthouse(report, url, 'baseline-1-lighthouse.json').lcp.status,
    ).toBe('not-available');
  }
});
it('uses five distinct inputs for median and preserves failed samples', () => {
  const samples = [1, 2, 1000, 4, 5].map((value, i) => {
    const report = fixture();
    report.audits['largest-contentful-paint'].numericValue = value;
    return {
      iteration: i + 1,
      evidencePath: `baseline-${i + 1}.json`,
      metrics: parseLighthouse(
        report,
        url,
        `baseline-${i + 1}-lighthouse.json`,
      ),
    };
  });
  expect(aggregateLighthouse(samples).lcp).toMatchObject({
    value: 4,
    aggregation: 'median',
    sampleCount: 5,
    evidencePaths: samples.map((x) => x.evidencePath),
  });
  expect(aggregateLighthouse(samples.slice(1)).lcp.status).toBe(
    'not-available',
  );
  expect(
    aggregateLighthouse([...samples.slice(1), samples[1]]).lcp.status,
  ).toBe('not-available');
  samples[0].metrics.lcp = {
    status: 'not-available',
    reason: 'fixture failure',
    evidencePaths: [],
  };
  expect(aggregateLighthouse(samples).lcp.status).toBe('not-available');
});
it('blocks real collection before browser launch when preflight failed', async () => {
  await expect(
    collectLighthouse(
      '/not-created',
      { experiment: 'default', routes: ['baseline'], dryRun: false },
      { status: 'failed' } as EnvironmentArtifact,
    ),
  ).rejects.toThrow('preflight');
});
