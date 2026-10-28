import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseInvestigation, verifiedSuggestions } from './investigation';
import { verifyInvestigationFile } from './investigation-files';
import { InvestigationLog } from '../../components/InvestigationLog';
import type { Investigation } from '../types/investigation';
const template = () =>
  JSON.parse(
    readFileSync('docs/templates/ai-investigation.json', 'utf8'),
  ) as Investigation;
// Synthetic validation fixture, never registered or published as an investigation.
function fixture(decision: 'accepted' | 'rejected' = 'accepted') {
  return {
    ...template(),
    id: `fixture-${decision}`,
    experimentId: 'large-list',
    status: 'verified' as const,
    question: `Fixture question ${decision}`,
    aiHypothesis: 'Synthetic test hypothesis',
    decision,
    decisionSummary: 'Fixture decision',
    reasoning: 'Fixture reasoning',
    evidenceInspected: [
      {
        artifact: {
          path: 'evidence/test.json',
          kind: 'log' as const,
          sha256: createHash('sha256').update('{}').digest('hex'),
          collectedAt: '2026-09-12T00:00:00.000Z',
        },
        finding: 'Fixture finding',
      },
    ],
    sourceLocations: [
      {
        path: 'src/fixture.ts',
        startLine: 1,
        endLine: 2,
        revision: 'fixture-revision',
      },
    ],
    verification: {
      reviewer: 'Test fixture',
      verifiedAt: '2026-09-12T00:00:00.000Z',
    },
  };
}
it('keeps blank template draft and refuses to verify without evidence or review', () => {
  expect(parseInvestigation(template()).status).toBe('draft');
  expect(() =>
    parseInvestigation({ ...template(), status: 'verified' }),
  ).toThrow();
  expect(() => parseInvestigation(fixture())).toThrow('Evidence');
  for (const patch of [
    { evidenceInspected: [] },
    { sourceLocations: [] },
    { reasoning: '' },
    { verification: null },
    { decision: 'pending' },
  ])
    expect(() =>
      parseInvestigation({ ...fixture(), ...patch }, () => true),
    ).toThrow();
});
it('accepts final reviewed decisions and validates missing references, source ranges and condition notes', () => {
  for (const decision of ['accepted', 'rejected'] as const)
    expect(parseInvestigation(fixture(decision), () => true).decision).toBe(
      decision,
    );
  expect(() =>
    parseInvestigation(
      { ...fixture(), relatedDiff: { status: 'not-available', reason: '' } },
      () => true,
    ),
  ).toThrow();
  const source = fixture();
  source.sourceLocations[0].endLine = 0;
  expect(() => parseInvestigation(source, () => true)).toThrow('range');
  const measured = fixture();
  measured.measurements.before = measured.evidenceInspected[0].artifact;
  expect(() => parseInvestigation(measured, () => true)).toThrow('condition');
  measured.measurements.conditions = 'Fixture-only matching configuration';
  expect(parseInvestigation(measured, () => true).status).toBe('verified');
});
it('checks real file integrity and rejects missing, empty, changed, traversal and symlink evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'investigation-fixture-'));
  const record = fixture();
  const artifact = record.evidenceInspected[0].artifact;
  try {
    mkdirSync(join(root, 'evidence'));
    const verify = () => verifyInvestigationFile(artifact, root);
    expect(verify()).toBe(false);
    writeFileSync(join(root, artifact.path), '{}');
    expect(verify()).toBe(true);
    expect(
      parseInvestigation(record, (a) => verifyInvestigationFile(a, root))
        .status,
    ).toBe('verified');
    writeFileSync(join(root, artifact.path), 'changed');
    expect(verify()).toBe(false);
    writeFileSync(join(root, artifact.path), '');
    expect(
      verifyInvestigationFile(
        { ...artifact, sha256: createHash('sha256').update('').digest('hex') },
        root,
      ),
    ).toBe(false);
    symlinkSync(join(root, artifact.path), join(root, 'evidence/link.json'));
    expect(
      verifyInvestigationFile(
        { ...artifact, path: 'evidence/link.json' },
        root,
      ),
    ).toBe(false);
    expect(() =>
      parseInvestigation(
        { ...record, relatedDiff: { ...artifact, path: 'evidence/../escape' } },
        () => true,
      ),
    ).toThrow('Unsafe');
    writeFileSync(join(root, 'record.json'), JSON.stringify(record));
    try {
      execFileSync(
        process.execPath,
        ['scripts/investigation.ts', join(root, 'record.json'), root],
        { stdio: 'pipe' },
      );
      throw new Error('Unexpected pass');
    } catch (error) {
      expect((error as { status: number }).status).toBe(1);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
it('case study displays only accepted/rejected records passing server verification', () => {
  const accepted = fixture();
  const rejected = fixture('rejected');
  const invalid = { ...fixture(), id: 'invalid', evidenceInspected: [] };
  const records = verifiedSuggestions(
    [accepted, rejected, template(), invalid],
    () => true,
  );
  expect(records).toHaveLength(2);
  render(<InvestigationLog records={records} />);
  expect(
    screen.getByRole('heading', { name: accepted.question }),
  ).toBeVisible();
  expect(
    screen.getByRole('heading', { name: rejected.question }),
  ).toBeVisible();
  expect(screen.getAllByText(/Before measurement: Not available/)).toHaveLength(
    2,
  );
  expect(verifiedSuggestions([accepted], () => false)).toEqual([]);
});
