import { createHash } from 'node:crypto';
import {
  lstat,
  mkdir,
  readFile,
  realpath,
  writeFile,
  readdir,
} from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { join, resolve, sep } from 'node:path';
import { plannedDefinitions } from '../definitions/planned.ts';
import { parseExperimentDefinition, parseExperimentRun } from './experiment.ts';
import type { ExperimentRun } from '../types/experiment';

const DOCUMENTS = [
  'prompt.md',
  'output.md',
  'diff.patch',
  'tests.txt',
  'environment.json',
  'raw-results.json',
  'human-evaluation.md',
] as const;
export interface EvidenceLocation {
  root: string;
  experimentId: string;
  runId: string;
}
interface Manifest {
  schemaVersion: 1;
  status: 'draft' | 'complete';
  experimentId: string;
  runId: string;
  createdAt: string;
}

function checkId(id: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || id.length > 100)
    throw new Error(
      'IDs must be lowercase letters/digits separated by hyphens (max 100 characters).',
    );
}
function getDefinition(id: string) {
  const definition = plannedDefinitions.find((item) => item.id === id);
  if (!definition) throw new Error(`Unknown experiment: ${id}`);
  return parseExperimentDefinition(definition);
}
function safeRelative(path: string) {
  if (
    !/^[a-zA-Z0-9_./-]+$/.test(path) ||
    path.split('/').some((part) => !part || part === '.' || part === '..')
  )
    throw new Error(`Unsafe evidence path: ${path}`);
}

/** Reject symlink components, not merely textual ../ traversal. */
async function checkedPath(
  root: string,
  relative: string,
  createDirectories = false,
): Promise<string> {
  safeRelative(relative);
  let current = root;
  for (const part of relative.split('/')) {
    current = join(current, part);
    if (createDirectories)
      await mkdir(current).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'EEXIST') throw error;
      });
    const info = await lstat(current);
    if (info.isSymbolicLink())
      throw new Error(`Symlinks are not allowed: ${relative}`);
  }
  const actual = await realpath(current);
  if (!actual.startsWith(root + sep))
    throw new Error(`Evidence path escapes root: ${relative}`);
  return current;
}
async function location(options: EvidenceLocation) {
  checkId(options.experimentId);
  checkId(options.runId);
  const definition = getDefinition(options.experimentId);
  const root = await realpath(resolve(options.root));
  return {
    root,
    definition,
    relative: `evidence/${options.experimentId}/${options.runId}`,
  };
}
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';

export async function createEvidenceRun(
  options: EvidenceLocation,
): Promise<string> {
  const { root, relative, definition } = await location(options);
  await checkedPath(root, `evidence/${options.experimentId}`, true);
  const directory = join(root, relative);
  // Atomic exclusive directory creation: never overwrite an existing run.
  await mkdir(directory);
  const reason =
    'Not available: this run has been scaffolded but no collection has been performed.';
  const run: ExperimentRun = {
    schemaVersion: 1,
    id: options.runId,
    experimentId: options.experimentId,
    status: 'not-available',
    reason,
    environment: { status: 'not-available', reason },
    artifacts: [],
    results: definition.approaches.flatMap(({ id: approach }) =>
      definition.metrics.map(({ id: metricId }) => ({
        approach,
        metricId,
        result: { status: 'not-available' as const, reason },
      })),
    ),
  };
  const manifest: Manifest = {
    schemaVersion: 1,
    status: 'draft',
    experimentId: options.experimentId,
    runId: options.runId,
    createdAt: new Date().toISOString(),
  };
  for (const name of DOCUMENTS) {
    const content =
      name === 'raw-results.json'
        ? json(run)
        : name === 'environment.json'
          ? json(run.environment)
          : name === 'diff.patch'
            ? ''
            : `# ${name}\n\nStatus: not-available\nReason: No ${name} evidence has been captured for this run.\n`;
    await writeFile(join(directory, name), content, { flag: 'wx' });
  }
  await writeFile(join(directory, 'manifest.json'), json(manifest), {
    flag: 'wx',
  });
  return directory;
}

async function readNonemptyFile(
  root: string,
  path: string,
  allowEmpty = false,
) {
  const filename = await checkedPath(root, path);
  if (!(await lstat(filename)).isFile())
    throw new Error(`Not a regular file: ${path}`);
  const data = await readFile(filename);
  if (!allowEmpty && data.length === 0)
    throw new Error(`Empty evidence file: ${path}`);
  return data;
}

/** Validates a retained bundle; does not certify parity, extraction accuracy or publication approval. */
export async function validateEvidenceRun(
  options: EvidenceLocation,
  allowDraft = false,
) {
  const { root, relative, definition } = await location(options);
  const manifest: unknown = JSON.parse(
    (await readNonemptyFile(root, `${relative}/manifest.json`)).toString(),
  );
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest))
    throw new Error('Invalid manifest');
  const fields = manifest as Record<string, unknown>;
  if (
    Object.keys(fields).sort().join(',') !==
      'createdAt,experimentId,runId,schemaVersion,status' ||
    fields.schemaVersion !== 1 ||
    fields.experimentId !== options.experimentId ||
    fields.runId !== options.runId ||
    !['draft', 'complete'].includes(String(fields.status)) ||
    typeof fields.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(fields.createdAt)) ||
    new Date(fields.createdAt).toISOString() !== fields.createdAt
  )
    throw new Error('Invalid manifest metadata');
  if (!allowDraft && fields.status !== 'complete')
    throw new Error(
      'Run is still draft; complete collection/review or use --allow-draft to inspect the scaffold.',
    );
  // Inspect every bundled path, including optional trace/heap/screenshot files.
  async function inspect(relativeDirectory: string) {
    const directory = await checkedPath(root, relativeDirectory);
    for (const name of await readdir(directory)) {
      const path = `${relativeDirectory}/${name}`;
      const filename = await checkedPath(root, path);
      const stat = await lstat(filename);
      if (stat.isDirectory()) await inspect(path);
      else if (!stat.isFile()) throw new Error(`Not a regular file: ${path}`);
    }
  }
  await inspect(relative);
  for (const name of DOCUMENTS)
    await readNonemptyFile(root, `${relative}/${name}`, name === 'diff.patch');
  const run = parseExperimentRun(
    JSON.parse(
      (await readFile(join(root, relative, 'raw-results.json'))).toString(),
    ),
    definition,
  );
  if (run.id !== options.runId)
    throw new Error('Run ID does not match directory');
  const environment: unknown = JSON.parse(
    await readFile(join(root, relative, 'environment.json'), 'utf8'),
  );
  if (!isDeepStrictEqual(environment, run.environment))
    throw new Error('environment.json differs from the run environment');
  for (const artifact of run.artifacts) {
    if (!artifact.path.startsWith(relative + '/'))
      throw new Error('Artifact must belong to this run directory');
    const data = await readNonemptyFile(root, artifact.path);
    if (createHash('sha256').update(data).digest('hex') !== artifact.sha256)
      throw new Error(`Checksum mismatch: ${artifact.path}`);
  }
  if (
    !('status' in run.environment) &&
    typeof run.environment.dirtyPatch === 'string'
  ) {
    if (run.environment.dirtyPatch !== `${relative}/diff.patch`)
      throw new Error('Dirty patch must reference this run diff.patch');
    await readNonemptyFile(root, run.environment.dirtyPatch);
  }
  return {
    directory: join(root, relative),
    status: fields.status,
    measuredResults: run.results.filter(
      (entry) => entry.result.status === 'measured',
    ).length,
    unavailableResults: run.results.filter(
      (entry) => entry.result.status === 'not-available',
    ).length,
  };
}
