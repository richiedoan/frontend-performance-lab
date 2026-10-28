// @vitest-environment node
import { it, expect } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { verifyPublicEvidence } from './public-evidence';
it('only verifies existing published regular files with matching checksum', () => {
  const root = mkdtempSync(join(tmpdir(), 'case-study-evidence-'));
  const artifact = {
    path: 'evidence/raw.json',
    kind: 'log' as const,
    sha256: createHash('sha256').update('{}').digest('hex'),
    collectedAt: '2026-09-12T00:00:00.000Z',
  };
  try {
    mkdirSync(join(root, 'evidence'));
    writeFileSync(join(root, artifact.path), '{}');
    expect(verifyPublicEvidence(artifact, root)).toBe(true);
    expect(
      verifyPublicEvidence({ ...artifact, sha256: '0'.repeat(64) }, root),
    ).toBe(false);
    expect(
      verifyPublicEvidence({ ...artifact, path: 'evidence/missing' }, root),
    ).toBe(false);
    expect(
      verifyPublicEvidence({ ...artifact, path: 'evidence/../raw.json' }, root),
    ).toBe(false);
    symlinkSync(join(root, artifact.path), join(root, 'evidence/link.json'));
    expect(
      verifyPublicEvidence({ ...artifact, path: 'evidence/link.json' }, root),
    ).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
