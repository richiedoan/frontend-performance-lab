/** Every publication must pass each check in the same pipeline and commit. */
export const requiredCheckJobs = [
  'ci-validate',
  'lint',
  'typecheck',
  'unit-tests',
  'build',
  'e2e',
] as const;
