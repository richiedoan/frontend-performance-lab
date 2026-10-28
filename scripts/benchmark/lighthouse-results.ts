import { profile } from './environment.ts';
import { median } from './runner-model.ts';
export const lighthouseThrottling = {
  cpuSlowdownMultiplier: profile.cpuRate,
  requestLatencyMs: profile.network.latency,
  downloadThroughputKbps: (profile.network.downloadThroughput * 8) / 1024,
  uploadThroughputKbps: (profile.network.uploadThroughput * 8) / 1024,
};
export const lighthouseVersion = '13.4.1';
export const metricAudits = {
  lcp: ['largest-contentful-paint', 'millisecond', 'ms'],
  cls: ['cumulative-layout-shift', 'unitless', 'unitless'],
  tbt: ['total-blocking-time', 'millisecond', 'ms'],
  speedIndex: ['speed-index', 'millisecond', 'ms'],
  transferSize: ['total-byte-weight', 'byte', 'bytes'],
  jsExecution: ['bootup-time', 'millisecond', 'ms'],
} as const;
export type Metric = keyof typeof metricAudits;
export type Value =
  | {
      status: 'measured';
      value: number;
      unit: string;
      aggregation: string;
      sampleCount: number;
      evidencePaths: string[];
    }
  | { status: 'not-available'; reason: string; evidencePaths: string[] };
export const fieldInp: Value = {
  status: 'not-available',
  reason:
    'No RUM evidence; Lighthouse TBT and synthetic durations are not field INP.',
  evidencePaths: [],
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected report object');
  return value as Record<string, unknown>;
}
export function parseLighthouse(
  input: unknown,
  url: string,
  evidencePath: string,
): Record<Metric, Value> {
  if (!/^(baseline|optimized)-[1-5]-lighthouse\.json$/.test(evidencePath))
    throw new Error('Unsafe report path');
  const report = object(input);
  if (
    report.lighthouseVersion !== lighthouseVersion ||
    report.requestedUrl !== url ||
    report.finalDisplayedUrl !== url ||
    typeof report.fetchTime !== 'string' ||
    !Number.isFinite(Date.parse(report.fetchTime))
  )
    throw new Error('Report version, URL or timestamp mismatch');
  if (report.runtimeError)
    throw new Error(
      'Lighthouse runtimeError: ' + JSON.stringify(report.runtimeError),
    );
  const settings = object(report.configSettings);
  if (
    settings.throttlingMethod !== 'devtools' ||
    settings.disableStorageReset !== true ||
    object(settings.screenEmulation).disabled !== true ||
    settings.emulatedUserAgent !== false
  )
    throw new Error('Lighthouse policy mismatch');
  const throttling = object(settings.throttling);
  for (const [key, value] of Object.entries(lighthouseThrottling))
    if (throttling[key] !== value)
      throw new Error('Throttling mismatch: ' + key);
  const audits = object(report.audits);
  return Object.fromEntries(
    Object.entries(metricAudits).map(([key, [auditId, numericUnit, unit]]) => {
      const audit = audits[auditId] ? object(audits[auditId]) : {};
      const valid =
        audit.numericUnit === numericUnit &&
        typeof audit.numericValue === 'number' &&
        Number.isFinite(audit.numericValue) &&
        audit.numericValue >= 0 &&
        !['error', 'notApplicable'].includes(String(audit.scoreDisplayMode));
      const value: Value = valid
        ? {
            status: 'measured',
            value: audit.numericValue as number,
            unit,
            aggregation: 'single navigation',
            sampleCount: 1,
            evidencePaths: [evidencePath],
          }
        : {
            status: 'not-available',
            reason: `Missing or invalid ${auditId}: ${String(audit.errorMessage ?? audit.scoreDisplayMode ?? 'numeric value/unit')}`,
            evidencePaths: [evidencePath],
          };
      return [key, value];
    }),
  ) as Record<Metric, Value>;
}
export function aggregateLighthouse(
  samples: {
    iteration: number;
    metrics: Partial<Record<Metric, Value>>;
    evidencePath: string;
  }[],
): Record<Metric, Value> {
  return Object.fromEntries(
    (Object.keys(metricAudits) as Metric[]).map((key) => {
      const values = samples.map((sample) => sample.metrics[key]);
      const evidencePaths = samples.map((sample) => sample.evidencePath);
      const complete =
        samples.length === 5 &&
        new Set(samples.map((sample) => sample.iteration)).size === 5 &&
        samples.every(
          (sample) => sample.iteration >= 1 && sample.iteration <= 5,
        ) &&
        values.every((value) => value?.status === 'measured');
      return [
        key,
        complete
          ? {
              status: 'measured',
              value: median(
                values.map(
                  (value) =>
                    (value as Extract<Value, { status: 'measured' }>).value,
                ),
              ),
              unit: metricAudits[key][2],
              aggregation: 'median',
              sampleCount: 5,
              evidencePaths,
            }
          : {
              status: 'not-available',
              reason:
                'Five distinct valid iterations required; missing/failed samples are retained.',
              evidencePaths,
            },
      ];
    }),
  ) as Record<Metric, Value>;
}
