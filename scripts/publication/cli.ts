import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { providerFailure } from './provider-error.ts';
import { publish } from './workflow.ts';
const execute = promisify(execFile);
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--dry-run')) {
  console.error('Usage: node scripts/publication/cli.ts [--dry-run]');
  process.exitCode = 1;
} else {
  await publish(
    process.cwd(),
    process.env,
    {
      command: async (command) => {
        if (command[0] === 'git-head')
          return (await execute('git', ['rev-parse', 'HEAD'])).stdout;
        const env: NodeJS.ProcessEnv = { NODE_ENV: 'production' };
        for (const key of [
          'PATH',
          'HOME',
          'TMPDIR',
          'CI',
          'VERCEL_ORG_ID',
          'VERCEL_PROJECT_ID',
          'NEXT_TELEMETRY_DISABLED',
        ])
          if (process.env[key]) env[key] = process.env[key];
        try {
          return (
            await execute(
              'npm',
              [
                'exec',
                '--yes',
                '--package=vercel@59.16.0',
                '--',
                'vercel',
                ...command,
                '--token',
                process.env.VERCEL_TOKEN!,
              ],
              { env, maxBuffer: 8 * 1024 * 1024 },
            )
          ).stdout;
        } catch (error) {
          throw providerFailure(error, command[0]);
        }
      },
    },
    args[0] === '--dry-run',
  )
    .then((report) => console.log(JSON.stringify(report)))
    .catch(() => {
      console.error(
        'Publication failed. See reports/publication.json; provider output is suppressed to protect credentials.',
      );
      process.exitCode = 1;
    });
}
