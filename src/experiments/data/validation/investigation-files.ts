import { lstatSync } from 'node:fs';
import { join } from 'node:path';
import type { Artifact } from '../types/experiment';
import { verifyPublicEvidence } from './public-evidence.ts';
export function verifyInvestigationFile(
  artifact: Artifact,
  root = join(process.cwd(), 'public'),
) {
  return (
    verifyPublicEvidence(artifact, root) &&
    lstatSync(join(root, artifact.path)).size > 0
  );
}
