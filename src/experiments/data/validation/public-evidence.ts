import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Artifact } from '../types/experiment';
/** Only files intentionally published under public/evidence can become clickable citations. */
export function verifyPublicEvidence(
  artifact: Artifact,
  publicRoot = join(process.cwd(), 'public'),
) {
  try {
    if (
      !artifact.path.startsWith('evidence/') ||
      !/^[a-zA-Z0-9_./-]+$/.test(artifact.path) ||
      artifact.path
        .split('/')
        .some((part) => !part || part === '.' || part === '..')
    )
      return false;
    let path = publicRoot;
    for (const part of artifact.path.split('/')) {
      path = join(path, part);
      if (lstatSync(path).isSymbolicLink()) return false;
    }
    return (
      lstatSync(path).isFile() &&
      createHash('sha256').update(readFileSync(path)).digest('hex') ===
        artifact.sha256
    );
  } catch {
    return false;
  }
}
