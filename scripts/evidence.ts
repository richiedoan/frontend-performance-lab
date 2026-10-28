import {
  createEvidenceRun,
  validateEvidenceRun,
} from '../src/experiments/data/validation/evidence-files.ts';

const usage =
  'Usage: yarn evidence:create|evidence:validate --experiment <id> --run <id> [--root <existing-directory>] [--allow-draft (validate only)]';
try {
  const [command, ...args] = process.argv.slice(2);
  if (!['create', 'validate'].includes(command)) throw new Error(usage);
  const options = new Map<string, string>();
  let allowDraft = false;
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === '--allow-draft' && command === 'validate' && !allowDraft) {
      allowDraft = true;
      continue;
    }
    if (
      !['--root', '--experiment', '--run'].includes(key) ||
      options.has(key) ||
      !args[i + 1] ||
      args[i + 1].startsWith('--')
    )
      throw new Error(usage);
    options.set(key, args[++i]);
  }
  const experimentId = options.get('--experiment');
  const runId = options.get('--run');
  if (!experimentId || !runId) throw new Error(usage);
  const location = {
    root: options.get('--root') ?? process.cwd(),
    experimentId,
    runId,
  };
  if (command === 'create')
    console.log(`Created draft: ${await createEvidenceRun(location)}`);
  else
    console.log(
      JSON.stringify(await validateEvidenceRun(location, allowDraft), null, 2),
    );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
