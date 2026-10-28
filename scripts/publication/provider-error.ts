import { PublicationValidationError } from './files.ts';

export class ProviderCommandError extends PublicationValidationError {
  readonly exitCode: number | null;
  readonly signal: string | null;

  constructor(check: string, exitCode: unknown, signal: unknown) {
    super(check);
    this.exitCode =
      typeof exitCode === 'number' &&
      Number.isInteger(exitCode) &&
      exitCode >= 0 &&
      exitCode <= 255
        ? exitCode
        : null;
    this.signal =
      typeof signal === 'string' &&
      ['SIGKILL', 'SIGTERM', 'SIGABRT', 'SIGSEGV', 'SIGINT', 'SIGBUS'].includes(
        signal,
      )
        ? signal
        : null;
  }
}

/** Classify provider failures without returning any command, URL or raw output. */
export function providerFailure(error: unknown, command?: string) {
  const detail =
    error && typeof error === 'object'
      ? (error as {
          code?: unknown;
          stderr?: unknown;
          stdout?: unknown;
          signal?: unknown;
        })
      : {};
  const output = [detail.stderr, detail.stdout]
    .filter((value): value is string => typeof value === 'string')
    .join('\n')
    .replace(/\u001b\[[0-9;]*m/g, '');
  let check = 'provider-command-failed';
  for (const code of [
    'ENOENT',
    'EACCES',
    'ETARGET',
    'E404',
    'EAI_AGAIN',
    'ENOTFOUND',
    'ECONNRESET',
    'ETIMEDOUT',
    'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',
    'ERR_MODULE_NOT_FOUND',
    'MODULE_NOT_FOUND',
    'ERR_REQUIRE_ESM',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'SELF_SIGNED_CERT_IN_CHAIN',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'CERT_HAS_EXPIRED',
    'ENOSPC',
    'EINTEGRITY',
  ]) {
    if (detail.code === code || new RegExp(`\\b${code}\\b`).test(output)) {
      check = `provider-${code}`;
      break;
    }
  }
  if (check === 'provider-command-failed') {
    // Fixed labels only; match known CLI messages without copying interpolated IDs.
    const messages: [RegExp, string][] = [
      [
        /specified token is not valid|invalid token|token has expired/i,
        'auth-token-rejected',
      ],
      [/No existing credentials found/i, 'credentials-missing'],
      [
        /do not have access to the specified (?:account|team)|scope-not-accessible/i,
        'scope-access-denied',
      ],
      [/specified scope does not exist|scope-not-existent/i, 'scope-not-found'],
      [/Project not found|PROJECT_NOT_FOUND/i, 'project-not-found'],
      [
        /Could not retrieve Project Settings|PROJECT_UNAUTHORIZED/i,
        'project-settings-unavailable',
      ],
      [
        /NOT_AUTHORIZED|not authorized|unauthorized|forbidden/i,
        'access-rejected',
      ],
      [/fetch failed|Connection to .* interrupted/i, 'connection-failed'],
      [/unknown or unexpected option|unknown option/i, 'cli-option-rejected'],
    ];
    for (const [pattern, label] of messages) {
      if (pattern.test(output)) {
        check = `provider-${label}`;
        break;
      }
    }
  }
  if (check === 'provider-command-failed' && command === 'build') {
    // Specific compiler/runtime failures take precedence over command-exit wrappers.
    const buildMessages: [RegExp, string][] = [
      [
        /heap out of memory|allocation failed.*heap|out of memory|Cannot allocate memory/i,
        'out-of-memory',
      ],
      [
        /Module not found:|Cannot find (?:module|package)|command not found|(?:tsc|next|yarn|npm): not found/i,
        'dependency-missing',
      ],
      [
        /error TS\d+:|Type error:|TypeScript error|Failed to type check/i,
        'typescript',
      ],
      [
        /Invalid (?:next\.config|vercel\.json)|invalid configuration|No (?:Next\.js version|Output Directory) detected|No Output Directory named|Failed to load next\.config/i,
        'configuration',
      ],
      [
        /Error occurred prerendering|prerender-error|Failed to collect page data/i,
        'prerender',
      ],
      [
        /Failed to compile|Build failed with \d+ errors?|SyntaxError:/i,
        'compilation',
      ],
      [
        /Command .* exited with (?:(?:code|exit code) )?\d+|Command failed with exit code \d+/i,
        'command-exited',
      ],
    ];
    for (const [pattern, label] of buildMessages) {
      if (pattern.test(output)) {
        check = `provider-build-${label}`;
        break;
      }
    }
  }
  if (
    check === 'provider-command-failed' &&
    ['SIGKILL', 'SIGTERM', 'SIGABRT', 'SIGSEGV', 'SIGINT', 'SIGBUS'].includes(
      String(detail.signal),
    )
  )
    check = 'provider-process-signaled';
  return new ProviderCommandError(check, detail.code, detail.signal);
}
