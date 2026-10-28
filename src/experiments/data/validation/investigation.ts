import type { Artifact, MissingResult } from '../types/experiment';
import type { Investigation } from '../types/investigation';
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected investigation object');
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(record, key))
  )
    throw new Error('Missing or unknown investigation fields');
  return record;
}
function text(value: unknown, required = true) {
  if (typeof value !== 'string' || (required && !value.trim()))
    throw new Error('Missing investigation text');
}
function safePath(value: unknown) {
  if (
    typeof value !== 'string' ||
    !/^[a-zA-Z0-9_./-]+$/.test(value) ||
    value.split('/').some((part) => !part || part === '.' || part === '..')
  )
    throw new Error('Unsafe investigation path');
}
function date(value: unknown) {
  if (
    typeof value !== 'string' ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  )
    throw new Error('Invalid verification date');
}
function missing(value: unknown): value is MissingResult {
  return (
    !!value &&
    typeof value === 'object' &&
    'status' in value &&
    value.status === 'not-available'
  );
}
function missingReason(value: unknown) {
  const m = object(value, ['status', 'reason']);
  if (m.status !== 'not-available')
    throw new Error('Invalid unavailable state');
  text(m.reason);
}
export function parseInvestigation(
  input: unknown,
  verifyArtifact: (artifact: Artifact) => boolean = () => false,
): Investigation {
  const value = object(input, [
    'schemaVersion',
    'id',
    'experimentId',
    'status',
    'question',
    'aiHypothesis',
    'evidenceInspected',
    'sourceLocations',
    'decision',
    'decisionSummary',
    'reasoning',
    'relatedDiff',
    'measurements',
    'verification',
  ]);
  if (
    value.schemaVersion !== 1 ||
    !['draft', 'verified'].includes(String(value.status)) ||
    !['pending', 'accepted', 'rejected'].includes(String(value.decision))
  )
    throw new Error('Invalid investigation state');
  const verified = value.status === 'verified';
  for (const field of ['id', 'experimentId'])
    if (
      typeof value[field] !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value[field])
    )
      throw new Error('Invalid investigation ID');
  for (const field of [
    'question',
    'aiHypothesis',
    'decisionSummary',
    'reasoning',
  ])
    text(value[field], verified);
  function artifact(input: unknown) {
    const a = object(input, ['path', 'kind', 'sha256', 'collectedAt']);
    safePath(a.path);
    if (
      !(a.path as string).startsWith('evidence/') ||
      !['trace', 'profile', 'log', 'screenshot'].includes(String(a.kind)) ||
      typeof a.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(a.sha256)
    )
      throw new Error('Invalid evidence reference');
    date(a.collectedAt);
    if (verified && !verifyArtifact(a as unknown as Artifact))
      throw new Error(
        'Evidence missing, unreadable or checksum verification failed',
      );
  }
  function optionalArtifact(input: unknown) {
    if (missing(input)) missingReason(input);
    else artifact(input);
  }
  if (
    !Array.isArray(value.evidenceInspected) ||
    !Array.isArray(value.sourceLocations)
  )
    throw new Error('Expected investigation arrays');
  if (
    verified &&
    (!value.evidenceInspected.length ||
      !value.sourceLocations.length ||
      value.decision === 'pending')
  )
    throw new Error(
      'Verified decision requires inspected evidence and source locations',
    );
  for (const entry of value.evidenceInspected) {
    const e = object(entry, ['artifact', 'finding']);
    artifact(e.artifact);
    text(e.finding, verified);
  }
  for (const entry of value.sourceLocations) {
    const s = object(entry, ['path', 'startLine', 'endLine', 'revision']);
    safePath(s.path);
    text(s.revision);
    if (
      !Number.isSafeInteger(s.startLine) ||
      !Number.isSafeInteger(s.endLine) ||
      Number(s.startLine) < 1 ||
      Number(s.endLine) < Number(s.startLine)
    )
      throw new Error('Invalid source line range');
  }
  optionalArtifact(value.relatedDiff);
  const measurements = object(value.measurements, [
    'before',
    'after',
    'conditions',
  ]);
  optionalArtifact(measurements.before);
  optionalArtifact(measurements.after);
  if (typeof measurements.conditions === 'string')
    text(measurements.conditions);
  else missingReason(measurements.conditions);
  if (
    verified &&
    (!missing(measurements.before) || !missing(measurements.after)) &&
    typeof measurements.conditions !== 'string'
  )
    throw new Error('Measurement references require condition notes');
  if (value.verification !== null) {
    const v = object(value.verification, ['reviewer', 'verifiedAt']);
    text(v.reviewer);
    date(v.verifiedAt);
  }
  if (verified && value.verification === null)
    throw new Error('Verified decisions require reviewer/date');
  return structuredClone(value) as unknown as Investigation;
}
export function verifiedSuggestions(
  inputs: unknown[],
  verifyArtifact: (artifact: Artifact) => boolean = () => false,
): Investigation[] {
  const ids = new Set<string>();
  return inputs.flatMap((input) => {
    try {
      const record = parseInvestigation(input, verifyArtifact);
      if (
        record.status !== 'verified' ||
        !['accepted', 'rejected'].includes(record.decision) ||
        ids.has(record.id)
      )
        return [];
      ids.add(record.id);
      return [record];
    } catch {
      return [];
    } // Never publish an unverified claim; CLI reports the validation error.
  });
}
