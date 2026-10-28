import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseInvestigation } from '../src/experiments/data/validation/investigation.ts';
import { verifyInvestigationFile } from '../src/experiments/data/validation/investigation-files.ts';
try {
  const [file, root, ...extra] = process.argv.slice(2);
  if (!file || extra.length)
    throw new Error(
      'Usage: yarn investigation:validate record.json [evidence-public-root]',
    );
  const record = parseInvestigation(
    JSON.parse(readFileSync(file, 'utf8')),
    (artifact) => verifyInvestigationFile(artifact, resolve(root ?? 'public')),
  );
  console.log(
    JSON.stringify(
      {
        id: record.id,
        status: record.status,
        decision: record.decision,
        valid: true,
        publishable: record.status === 'verified',
        note: 'Integrity validation is not independent verification of reasoning or measurement accuracy.',
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
