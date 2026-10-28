import { loadVerifiedSummary } from './budget-evidence.ts';
import { budgetMetrics, compareBudgets, type BudgetMetric } from './budget.ts';
async function main() {
  const [candidatePath, referencePath, ...flags] = process.argv.slice(2);
  if (
    !candidatePath ||
    !referencePath ||
    flags.some(
      (flag) =>
        !/^--(metrics|tolerance|approved-reference-sha256)=.+$/.test(flag),
    ) ||
    new Set(flags.map((flag) => flag.split('=')[0])).size !== flags.length
  )
    throw new Error(
      'Usage: yarn benchmark:budget candidate.json reference.json [--metrics=initial-js-bytes,long-task-count,dom-node-count,search-duration] [--tolerance=0.02] [--approved-reference-sha256=HASH]',
    );
  const option = (key: string) =>
    flags.find((flag) => flag.startsWith(`--${key}=`))?.slice(key.length + 3);
  const toleranceText = option('tolerance') ?? '0';
  if (!/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(toleranceText))
    throw new Error('Tolerance must be a decimal fraction 0..1');
  const approved = option('approved-reference-sha256');
  if (approved && !/^[a-f0-9]{64}$/.test(approved))
    throw new Error('Invalid approved reference SHA-256');
  const candidate = await loadVerifiedSummary(candidatePath);
  const reference = await loadVerifiedSummary(referencePath);
  const report = compareBudgets(
    candidate,
    reference,
    (option('metrics')?.split(',') ??
      Object.keys(budgetMetrics)) as BudgetMetric[],
    Number(toleranceText),
    approved,
  );
  console.log(
    JSON.stringify(
      {
        ...report,
        inputs: { candidatePath, referencePath },
        approvedReferenceSha256: approved,
      },
      null,
      2,
    ),
  );
  process.exitCode =
    report.status === 'pass' ? 0 : report.status === 'regression' ? 1 : 2;
}
main().catch((error) => {
  console.log(
    JSON.stringify(
      {
        status:
          (error as NodeJS.ErrnoException).code === 'ENOENT'
            ? 'unavailable'
            : 'invalid',
        reason: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 2;
});
