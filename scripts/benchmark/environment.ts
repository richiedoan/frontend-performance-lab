import profile from '../../benchmark/profile.json' with { type: 'json' };
export { profile };
export interface EnvironmentObservation {
  nodeVersion: string;
  yarnVersion: string;
  playwrightVersion: string;
  browser: {
    version: string;
    revision: string;
    distribution: string;
    executable: string;
    sha256: string;
    product: string;
  };
  viewport: typeof profile.viewport;
  locale: string;
  timezoneId: string;
  online: boolean;
  reducedMotion?: boolean;
  applied: {
    cpuRate: number;
    network: typeof profile.network;
    cacheDisabled: boolean;
    cacheCleared: boolean;
    freshContext: boolean;
    serviceWorkers: string;
    headless: boolean;
  };
  storage: { cookies: number; origins: number };
  dataset: {
    seed: number;
    recordCount: number;
    generatorVersion: number;
    schemaVersion?: number;
    sha256: string;
  };
  source: {
    commitSha: string;
    dirty: boolean;
    status: string;
    patchSha256: string;
  };
  os: {
    platform: string;
    release: string;
    arch: string;
    cpu: string;
    totalMemory: number;
  };
  plan: {
    measuredIterations: number;
    warmupIterations: number;
    cacheState: string;
  };
}
export interface EnvironmentArtifact {
  schemaVersion: 1;
  profileId: string;
  recordedAt: string;
  status: 'passed' | 'failed';
  observed: Partial<EnvironmentObservation>;
  failures: string[];
  limitations: string[];
}
export function checkEnvironment(o: Partial<EnvironmentObservation>): string[] {
  const failures: string[] = [];
  const equal = (name: string, actual: unknown, expected: unknown) => {
    if (actual !== expected)
      failures.push(
        `${name}: expected ${JSON.stringify(expected)}, observed ${JSON.stringify(actual) ?? 'missing'}`,
      );
  };
  equal('Node', o.nodeVersion, profile.nodeVersion);
  equal('Yarn', o.yarnVersion, profile.yarnVersion);
  equal('Playwright', o.playwrightVersion, profile.playwrightVersion);
  equal('Chrome version', o.browser?.version, profile.chromeVersion);
  equal('Chrome revision', o.browser?.revision, profile.chromeRevision);
  equal('Chrome distribution', o.browser?.distribution, 'Chrome for Testing');
  if (
    !o.browser?.executable ||
    !/^[a-f0-9]{64}$/.test(o.browser?.sha256 ?? '') ||
    !o.browser?.product
  )
    failures.push('Missing actual browser identity');
  for (const key of ['width', 'height', 'deviceScaleFactor'] as const)
    equal(`viewport.${key}`, o.viewport?.[key], profile.viewport[key]);
  equal('locale', o.locale, profile.locale);
  equal('timezone', o.timezoneId, profile.timezoneId);
  equal('online', o.online, true);
  equal('CPU throttle acknowledgement', o.applied?.cpuRate, profile.cpuRate);
  for (const key of [
    'offline',
    'latency',
    'downloadThroughput',
    'uploadThroughput',
  ] as const)
    equal(`network.${key}`, o.applied?.network?.[key], profile.network[key]);
  for (const key of [
    'cacheDisabled',
    'cacheCleared',
    'freshContext',
    'headless',
  ] as const)
    equal(key, o.applied?.[key], true);
  equal('serviceWorkers', o.applied?.serviceWorkers, profile.serviceWorkers);
  equal('cookies', o.storage?.cookies, 0);
  equal('origins', o.storage?.origins, 0);
  equal('dataset.seed', o.dataset?.seed, profile.seed);
  equal('dataset.count', o.dataset?.recordCount, profile.recordCount);
  if (
    !o.dataset?.generatorVersion ||
    !/^[a-f0-9]{64}$/.test(o.dataset?.sha256 ?? '')
  )
    failures.push('Missing dataset identity');
  equal(
    'measuredIterations (plan)',
    o.plan?.measuredIterations,
    profile.measuredIterations,
  );
  equal(
    'warmupIterations (plan)',
    o.plan?.warmupIterations,
    profile.warmupIterations,
  );
  equal('cacheState', o.plan?.cacheState, profile.cacheState);
  if (
    !/^[a-f0-9]{40}$/.test(o.source?.commitSha ?? '') ||
    typeof o.source?.dirty !== 'boolean' ||
    !/^[a-f0-9]{64}$/.test(o.source?.patchSha256 ?? '')
  )
    failures.push('Missing source identity');
  if (
    !o.os?.platform ||
    !o.os.release ||
    !o.os.arch ||
    !o.os.cpu ||
    !Number.isFinite(o.os.totalMemory) ||
    o.os.totalMemory <= 0
  )
    failures.push('Missing OS/machine metadata');
  return failures;
}
