import { expect, it } from 'vitest';
import {
  checkEnvironment,
  profile,
  type EnvironmentObservation,
} from './environment';
function accepted(): EnvironmentObservation {
  return {
    nodeVersion: profile.nodeVersion,
    yarnVersion: profile.yarnVersion,
    playwrightVersion: profile.playwrightVersion,
    browser: {
      version: profile.chromeVersion,
      revision: profile.chromeRevision,
      distribution: 'Chrome for Testing',
      executable: '/fixture/chrome',
      sha256: 'a'.repeat(64),
      product: `HeadlessChrome/${profile.chromeVersion}`,
    },
    viewport: { ...profile.viewport },
    locale: profile.locale,
    timezoneId: profile.timezoneId,
    online: true,
    applied: {
      cpuRate: profile.cpuRate,
      network: { ...profile.network },
      cacheDisabled: true,
      cacheCleared: true,
      freshContext: true,
      serviceWorkers: 'block',
      headless: true,
    },
    storage: { cookies: 0, origins: 0 },
    dataset: {
      seed: profile.seed,
      recordCount: profile.recordCount,
      generatorVersion: 1,
      sha256: 'b'.repeat(64),
    },
    source: {
      commitSha: 'c'.repeat(40),
      dirty: false,
      status: '',
      patchSha256: 'd'.repeat(64),
    },
    os: {
      platform: 'fixture',
      release: 'fixture',
      arch: 'fixture',
      cpu: 'fixture',
      totalMemory: 1024,
    },
    plan: {
      measuredIterations: 5,
      warmupIterations: 0,
      cacheState: profile.cacheState,
    },
  };
}
it('accepts the pinned environment and explicitly recorded dirty source', () => {
  expect(checkEnvironment(accepted())).toEqual([]);
  const dirty = accepted();
  dirty.source.dirty = true;
  dirty.source.status = ' M fixture.ts';
  expect(checkEnvironment(dirty)).toEqual([]);
});
it.each([
  [
    'Node',
    (o: EnvironmentObservation) => {
      o.nodeVersion = '24.0.0';
    },
  ],
  [
    'Yarn',
    (o: EnvironmentObservation) => {
      o.yarnVersion = '4.0.0';
    },
  ],
  [
    'Playwright',
    (o: EnvironmentObservation) => {
      o.playwrightVersion = '0.0.0';
    },
  ],
  [
    'Chrome version',
    (o: EnvironmentObservation) => {
      o.browser.version = '1.2.3.4';
    },
  ],
  [
    'Chrome revision',
    (o: EnvironmentObservation) => {
      o.browser.revision = 'unknown';
    },
  ],
  [
    'Chrome distribution',
    (o: EnvironmentObservation) => {
      o.browser.distribution = 'Chrome Headless Shell';
    },
  ],
  [
    'viewport',
    (o: EnvironmentObservation) => {
      o.viewport.width = 1280;
    },
  ],
  [
    'CPU',
    (o: EnvironmentObservation) => {
      o.applied.cpuRate = 1;
    },
  ],
  [
    'network',
    (o: EnvironmentObservation) => {
      o.applied.network.latency = 0;
    },
  ],
  [
    'cacheDisabled',
    (o: EnvironmentObservation) => {
      o.applied.cacheDisabled = false;
    },
  ],
  [
    'cookies',
    (o: EnvironmentObservation) => {
      o.storage.cookies = 1;
    },
  ],
  [
    'dataset.seed',
    (o: EnvironmentObservation) => {
      o.dataset.seed = 42;
    },
  ],
  [
    'dataset.count',
    (o: EnvironmentObservation) => {
      o.dataset.recordCount = 20;
    },
  ],
  [
    'measuredIterations',
    (o: EnvironmentObservation) => {
      o.plan.measuredIterations = 1;
    },
  ],
  [
    'source',
    (o: EnvironmentObservation) => {
      o.source.commitSha = '';
    },
  ],
  [
    'OS',
    (o: EnvironmentObservation) => {
      o.os.cpu = '';
    },
  ],
] as const)('rejects critical mismatch: %s', (field, mutate) => {
  const fixture = accepted();
  mutate(fixture);
  expect(checkEnvironment(fixture).join('\n')).toContain(field);
});
it('fails explicitly for missing observations instead of substituting expected values', () => {
  const failures = checkEnvironment({});
  expect(failures.length).toBeGreaterThan(20);
  expect(failures.join('\n')).toContain('observed missing');
});
