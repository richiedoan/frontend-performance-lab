import { expect, it } from 'vitest';
import { providerFailure } from './provider-error';

it.each(['ENOENT', 'EACCES', 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'])(
  'retains only the allowlisted process code %s',
  (code) => {
    const error = providerFailure({
      code,
      message: 'token-secret',
      stdout: 'secret',
    });
    expect(error.check).toBe(`provider-${code}`);
    expect(String(error)).not.toContain('secret');
  },
);
it.each([
  'ETARGET',
  'E404',
  'EAI_AGAIN',
  'ENOTFOUND',
  'ECONNRESET',
  'ETIMEDOUT',
])(
  'recognizes %s in private stderr without exposing provider output',
  (code) => {
    const error = providerFailure({
      code: 1,
      stderr: `npm error code ${code}\nhttps://user:secret@example.test`,
    });
    expect(error.check).toBe(`provider-${code}`);
    expect(String(error)).not.toContain('secret');
  },
);
it.each([
  null,
  'secret',
  { code: 'secret', stderr: 'unknown failure token=secret' },
])('keeps unknown failures opaque', (input) => {
  expect(providerFailure(input).check).toBe('provider-command-failed');
});

it.each([
  ['The specified token is not valid. Use vercel login', 'auth-token-rejected'],
  ['No existing credentials found.', 'credentials-missing'],
  ['You do not have access to the specified team', 'scope-access-denied'],
  ['The specified scope does not exist', 'scope-not-found'],
  [
    'Project not found ({"VERCEL_PROJECT_ID":"private-id"})',
    'project-not-found',
  ],
  ['Could not retrieve Project Settings.', 'project-settings-unavailable'],
  ['Forbidden', 'access-rejected'],
  ['TypeError: fetch failed', 'connection-failed'],
  ['unknown or unexpected option: --test', 'cli-option-rejected'],
  ['Error [ERR_MODULE_NOT_FOUND]', 'ERR_MODULE_NOT_FOUND'],
  ['SELF_SIGNED_CERT_IN_CHAIN', 'SELF_SIGNED_CERT_IN_CHAIN'],
])(
  'classifies provider message %s without exposing output',
  (message, label) => {
    for (const stream of ['stderr', 'stdout']) {
      const error = providerFailure({
        code: 1,
        [stream]: `\u001b[31m${message}\u001b[0m\nhttps://user:secret@example.test/?token=private-id`,
      });
      expect(error.check).toBe(`provider-${label}`);
      expect(String(error)).not.toContain('private-id');
      expect(String(error)).not.toContain('secret');
    }
  },
);

it.each([
  [
    'FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory',
    'out-of-memory',
  ],
  ["Module not found: Cannot resolve 'private-package'", 'dependency-missing'],
  ['sh: 1: next: not found', 'dependency-missing'],
  ['Failed to compile.\nType error: private source text', 'typescript'],
  ['src/private.ts(1,2): error TS2307: private source text', 'typescript'],
  ['Invalid next.config.ts options detected', 'configuration'],
  ['No Output Directory named "private-path" found', 'configuration'],
  ['Error occurred prerendering page "/private-path"', 'prerender'],
  ['Failed to compile.', 'compilation'],
  ['Command "private-command" exited with 1', 'command-exited'],
])('classifies build output %s', (message, category) => {
  for (const stream of ['stdout', 'stderr']) {
    const result = providerFailure(
      {
        code: 1,
        [stream]: `${message}\nCommand failed with exit code 1.\nsecret-token signed-url private-source`,
      },
      'build',
    );
    expect(result.check).toBe(`provider-build-${category}`);
    expect(result.exitCode).toBe(1);
    expect(result.signal).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(
      /secret-token|signed-url|private-source|private-path|private-command/,
    );
  }
});
it('keeps build classification scoped to build commands', () => {
  expect(providerFailure({ stderr: 'Type error: secret' }, 'pull').check).toBe(
    'provider-command-failed',
  );
});
it('retains termination signal without claiming it proves memory exhaustion', () => {
  const result = providerFailure(
    { code: null, signal: 'SIGKILL', stderr: 'private' },
    'build',
  );
  expect(result).toMatchObject({
    check: 'provider-process-signaled',
    exitCode: null,
    signal: 'SIGKILL',
  });
});
it.each([NaN, -1, 256, 1.5, 'secret'])(
  'rejects unsafe exit metadata %s',
  (code) => {
    const result = providerFailure(
      { code, signal: 'secret', stderr: 'private' },
      'build',
    );
    expect(result).toMatchObject({
      check: 'provider-command-failed',
      exitCode: null,
      signal: null,
    });
  },
);
