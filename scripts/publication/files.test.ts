import { expect, it } from 'vitest';
import { assertNoSecrets, credentialValues } from './files';

it.each(['true', 'false'])(
  'excludes the GitLab scope flag %s while retaining real credentials',
  (flag) => {
    const secrets = credentialValues({
      CI_JOB_TOKEN_SCOPE_ENABLED: flag,
      CI_JOB_TOKEN: 'job-secret',
      GITLAB_PUBLICATION_READ_TOKEN: 'read-secret',
      VERCEL_TOKEN: 'vercel-secret',
      API_SECRET: 'api-secret',
      DATABASE_PASSWORD: 'database-secret',
      SSH_PRIVATE_KEY: 'key-secret',
    });
    expect(secrets).toEqual([
      'job-secret',
      'read-secret',
      'vercel-secret',
      'api-secret',
      'database-secret',
      'key-secret',
    ]);
    expect(() =>
      assertNoSecrets('{"reducedMotion":false,"valid":true}', secrets),
    ).not.toThrow();
    for (const secret of secrets)
      expect(() => assertNoSecrets(secret, secrets)).toThrow('credential');
  },
);
it('does not exempt short or boolean-like values of actual token variables', () => {
  for (const value of ['true', 'false', 'abc']) {
    expect(() =>
      assertNoSecrets(value, credentialValues({ VERCEL_TOKEN: value })),
    ).toThrow('credential');
  }
});
it.each([
  'CI_JOB_TOKEN_SCOPE_ENABLED',
  'FF_GIT_URLS_WITHOUT_TOKENS',
  'FF_MASK_ALL_DEFAULT_TOKENS',
  'FF_DISABLE_AUTOMATIC_TOKEN_ROTATION',
  'FF_SECRET_RESOLVING_FAILS_IF_MISSING',
])('exempts only boolean metadata for %s', (key) => {
  for (const value of ['true', 'false', '1', '0'])
    expect(credentialValues({ [key]: value })).toEqual([]);
  expect(credentialValues({ [key]: 'unexpected-sensitive-value' })).toEqual([
    'unexpected-sensitive-value',
  ]);
  expect(credentialValues({ FF_CUSTOM_TOKEN: 'false' })).toEqual(['false']);
});
it('reports trusted check labels and fixed boundary codes without leaking exception text', async () => {
  const { failureCheck, PublicationValidationError } = await import('./files');
  expect(failureCheck(new PublicationValidationError('raw unit'), [])).toBe(
    'raw unit',
  );
  expect(
    failureCheck(new PublicationValidationError('raw unit'), ['raw']),
  ).toBe('[redacted] unit');
  expect(failureCheck(new Error('signed-url-secret'), [])).toBe(
    'boundary-error',
  );
  expect(failureCheck(new SyntaxError('secret malformed input'), [])).toBe(
    'malformed-json',
  );
  expect(
    failureCheck(
      Object.assign(new Error('secret path'), { code: 'ENOENT' }),
      [],
    ),
  ).toBe('ENOENT');
});
