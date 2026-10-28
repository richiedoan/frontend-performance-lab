import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, parse, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

export class PublicationValidationError extends Error {
  check: string;
  constructor(check: string) {
    super(`Publication validation: ${check}`);
    this.check = check;
  }
}
export function requireValue(value: unknown, label: string): asserts value {
  if (!value) throw new PublicationValidationError(label);
}
export function equal(actual: unknown, expected: unknown, label: string) {
  requireValue(isDeepStrictEqual(actual, expected), label);
}
export function safePath(path: string) {
  requireValue(
    typeof path === 'string' &&
      /^[a-zA-Z0-9_./-]+$/.test(path) &&
      path.split('/').every((part) => part && part !== '.' && part !== '..'),
    'unsafe path',
  );
  return path;
}
export async function noLinks(path: string) {
  const absolute = resolve(path);
  let cursor = parse(absolute).root;
  for (const part of absolute.slice(cursor.length).split('/').filter(Boolean)) {
    cursor = join(cursor, part);
    try {
      requireValue(!(await lstat(cursor)).isSymbolicLink(), 'symlink rejected');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return absolute;
}
export const hash = (data: string | Uint8Array) =>
  createHash('sha256').update(data).digest('hex');
export async function readSafe(root: string, path: string) {
  const file = await noLinks(join(root, safePath(path)));
  const stat = await lstat(file);
  requireValue(
    stat.isFile() && stat.size <= 8 * 1024 * 1024,
    'file type or size',
  );
  return readFile(file, 'utf8');
}
export async function writeSafe(root: string, path: string, data: string) {
  const file = await noLinks(join(root, safePath(path)));
  await mkdir(dirname(file), { recursive: true });
  try {
    equal(await readFile(file, 'utf8'), data, 'existing evidence conflict');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await writeFile(file, data, { flag: 'wx' });
  }
}
export async function jsonFile(root: string, path: string): Promise<unknown> {
  return JSON.parse(await readSafe(root, path));
}
export async function replaceJson(root: string, path: string, value: unknown) {
  const file = await noLinks(join(root, safePath(path)));
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.publication-tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', {
    flag: 'wx',
  });
  await rename(temporary, file);
}
export function record(input: unknown): Record<string, unknown> {
  requireValue(
    input && typeof input === 'object' && !Array.isArray(input),
    'object required',
  );
  return input as Record<string, unknown>;
}

export function assertNoSecrets(data: string, secrets: string[]) {
  requireValue(
    !secrets.filter(Boolean).some((secret) => data.includes(secret)),
    'credential in publication data',
  );
}

// These documented GitLab/Runner flags are metadata, not credentials.
// Do not exempt arbitrary FF_* variables or boolean-like token values.
const credentialMetadataFlags = new Set([
  'CI_JOB_TOKEN_SCOPE_ENABLED',
  'FF_GIT_URLS_WITHOUT_TOKENS',
  'FF_MASK_ALL_DEFAULT_TOKENS',
  'FF_DISABLE_AUTOMATIC_TOKEN_ROTATION',
  'FF_SECRET_RESOLVING_FAILS_IF_MISSING',
]);
export function credentialValues(env: Record<string, string | undefined>) {
  return Object.entries(env)
    .filter(
      ([key, value]) =>
        /TOKEN|SECRET|PASSWORD|PRIVATE_KEY/.test(key) &&
        !(
          credentialMetadataFlags.has(key) &&
          ['true', 'false', '1', '0'].includes(value ?? '')
        ),
    )
    .map(([, value]) => value ?? '');
}

/** Only emit our check labels or fixed boundary codes, never raw exception text. */
export function failureCheck(error: unknown, secrets: string[]) {
  let check = 'boundary-error';
  if (error instanceof PublicationValidationError) check = error.check;
  else if (error instanceof SyntaxError) check = 'malformed-json';
  else if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    ['ENOENT', 'EACCES', 'EEXIST'].includes(String(error.code))
  )
    check = String(error.code);
  for (const secret of secrets.filter(Boolean))
    check = check.split(secret).join('[redacted]');
  return check;
}
