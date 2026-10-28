# GitLab CI and local reproduction

## Hosting inspection

Origin is `gitlab.com/richie.doan/frontend-performance-lab`, project 86358534,
default branch `main`. GitLab metadata inspected on 2026-09-12 reports shared runners
and separated protected caches enabled, Auto DevOps disabled, and merge-on-success
not enforced. No existing CI file, Dockerfile, Vercel deployment config or app hosting
binding was found in the repository. The portfolio Vercel URL in README is a styling
reference, not evidence that this application is deployed there. The repository now contains an opt-in publication job; no remote project setting
has been changed. Dedicated runner availability
and actual deployment/provider settings remain unverified.

## Existing Docker runner on Mac

All jobs now select `performance-lab-dedicated` through `default.tags`, including
correctness, E2E and both publication jobs. The four measurement jobs retain their
explicit matching tags. This routes jobs to the existing self-hosted Docker runner;
job images, commands, artifact transfer, publication gates and credentials are unchanged.
GitLab-hosted runners without that tag cannot pick up these jobs. Keep Docker Desktop
and the runner running; jobs remain pending when no eligible runner is online.

External runner configuration is not changed by this repository:

- Confirm the runner is assigned to this project and has the matching tag.
- A protected runner may not accept ordinary feature-branch/MR pipelines. Preserve
  its protection for production credentials; those refs need a separately isolated,
  eligible runner with the same tag if their checks must run. Do not remove protection
  from the production runner just to clear pending jobs.
- For the single Mac runner, set `limit = 1` in its `[[runners]]` section of
  `config.toml` to prevent build/test/publication jobs overlapping benchmark jobs,
  including across pipelines. If multiple runner registrations share the Mac,
  coordinate their capacity too. This serializes jobs and may increase queue time.
  Existing measurement and deployment resource groups remain separate; they alone
  do not prevent cross-workload CPU contention. See
  [Runner concurrency configuration](https://docs.gitlab.com/runner/configuration/advanced-configuration/).
- Moving execution does not change artifact storage on GitLab or resolve provider
  errors such as Vercel pull failures. No remote runner/project setting is changed here.

## Branch and MR behavior

`.gitlab-ci.yml` runs six required jobs for merge requests and branch pipelines.
Pushes on a branch with an open MR suppress the duplicate branch pipeline. Tags are
excluded; web/scheduled branch pipelines run the same six checks.

| Job | Responsibility |
| --- | --- |
| `ci-validate` | Parse CI YAML and verify repository pipeline invariants. |
| `lint` | ESLint with zero warnings allowed. |
| `typecheck` | Next route type generation and TypeScript checks. |
| `unit-tests` | Vitest, with its own JUnit report. |
| `build` | Production build, uploaded as a `.next/` artifact excluding `.next/cache/`. |
| `e2e` | Install Chromium and run all parity/E2E tests against the production server using that build. |

The first five jobs share the `correctness` stage and can run in parallel subject
to runner capacity. Each performs the existing pinned, locked dependency install;
only the dependency download cache is shared, not `node_modules` or build output.
`e2e` has `needs: build` with `artifacts: true`, so it can start as soon as that
pipeline's build succeeds without waiting for lint/unit tests. It does not rebuild.
Its own checkout supplies `public/` and its locked install supplies dependencies.
E2E uses one worker and zero retries; performance collectors under `scripts/` are
outside the E2E test directory. No correctness job invokes benchmark collection.
Benchmark and memory use the later benchmark stage without early `needs`, so they
wait for all six required jobs. They download no check artifacts and retain their
own existing preflight/build procedures. Retry the specific failed check rather
than rerunning all six; an expired build artifact requires a fresh build before E2E.

Enable **Settings → Merge requests → Pipelines must succeed** and protect `main`
to enforce all six check jobs before merging. That setting is currently off;
a YAML job alone cannot enforce the project's merge policy. Review fork MR code
before running it in the parent project; do not expose protected secrets to it.

Node is `node:24.19.0-bookworm-slim`; scripts check Node 24.19.0 and Yarn 1.22.22.
The shared setup installs `git` and `ca-certificates` using apt before the locked
install and `git diff` check. The slim job image lacks Git even though the runner
can check out the repository using its separate helper. This setup applies to all
three jobs and requires root in the container and access to Debian package mirrors.
The image tag is version-pinned but not digest-pinned; image pull and Linux execution
must still be verified on GitLab. Playwright/browser revisions resolve from yarn.lock.
Cache only `.yarn-cache/`, keyed by lockfile, branch slug and protected-ref state.
No node_modules, .next build or browser cache is reused. Preserve GitLab's separated
protected caches setting; lockfile/integrity validation still runs on every install.
JUnit files use separate `reports/unit.xml` and `test-results/e2e.xml` paths because
Playwright clears its output directory at startup.

## Manual and scheduled measurements

The `benchmark` stage contains four independent optional jobs, never MR jobs:

| Job | Scheduled opt-in | Collection/output |
| --- | --- | --- |
| `benchmark-journey` | `RUN_BENCHMARKS=true` | Five baseline + five optimized journey iterations in `artifacts/benchmarks/`; automation-inclusive duration in ms. |
| `benchmark-lighthouse` | `RUN_LIGHTHOUSE=true` | Paired navigation collection using `--lighthouse`, with raw reports and summary in `artifacts/benchmarks/`. |
| `benchmark-bundle` | `RUN_BUNDLE=true` | Production build followed by `bundle:analyze`; asset sizes/loading observations in `artifacts/bundle-loading/`. One observation per route, not a five-iteration timing benchmark. |
| `benchmark-memory` | `RUN_MEMORY=true` | Existing memory journey and metadata in `artifacts/memory/`. |

On protected branch refs each job can be started manually. Schedule flags are
independent and do not automatically enable publication. `BENCHMARK_EXPERIMENT`
defaults to `large-list` for journey and Lighthouse; bundle uses its fixed isolated
bundle-loading scenario and memory retains its own `MEMORY_*` settings.
All four require the `performance-lab-dedicated` runner tag and share a resource
group to serialize measurement jobs in this project. Register a protected dedicated
runner with that tag and validate it before use; without one jobs remain pending.
The tag is a scheduling control, not proof of isolation from other projects/OS work.

Every job runs `benchmark:preflight` before collection; command failure stops the job.
The comparison runner repeats its own preflight and builds production. None of these measurement jobs publishes records directly. The opt-in publication job below
validates journey artifacts independently before publishing scoped measurements. They are optional
(`allow_failure: true`) for merge readiness, but failures and invalid environments
remain visible in logs/artifacts. Never reinterpret an optional failure as a pass.
No full performance or memory collection is started as part of this CI setup task.

Memory remains the existing 1280×720/unthrottled diagnostic journey, not the
mobile-cold-v1 benchmark. The preflight proves prerequisites, not equivalence of
those memory conditions to the mobile profile. Review raw memory browser/version,
GC and per-cycle metadata separately; do not use that preflight to promote a memory
comparison. A successful preflight does not calibrate CPU or remove thermal/load noise.

## Artifacts and validation

`unit-tests` retains its JUnit report for 7 days; `e2e` retains its JUnit report
and Playwright failure traces for 7 days. `build` retains successful `.next/` output
for 1 day solely for E2E reuse, excluding the framework cache.
If setup fails before tests run, missing-report upload warnings are expected;
inspect the first failing command rather than creating placeholder test reports.
Benchmark and memory retain artifacts/test-results for 30 days, including failures.
Project/instance size limits, cancellation and GitLab's **keep latest successful
artifacts** setting can affect retention; that keep-latest setting is currently on.
Download and review durable evidence before expiration. The measurement jobs do not publish GitLab Pages or directly alter the registry.
The separate publication job can build validated journey records into the app.

`yarn ci:validate` parses YAML with ESLint's installed js-yaml dependency and checks
repository-specific ordering, locked install, caching, job gates and retention. It
is not GitLab's server validator. A project CI Lint request returned 403 during this
task; use the authenticated Pipeline Editor → Validate before first pipeline execution.
No token is stored in this repository. Remote pipeline execution still requires pushing
these changes; no push, commit or remote pipeline was requested/performed.

Local correctness reproduction (Node 24.19.0 / Yarn 1.22.22):

```sh
yarn install --frozen-lockfile --non-interactive
yarn ci:validate
yarn lint
yarn typecheck
yarn test --reporter=default --reporter=junit --outputFile=reports/unit.xml
yarn build
yarn playwright install --with-deps chromium
PLAYWRIGHT_JUNIT_OUTPUT_FILE=test-results/e2e.xml yarn test:e2e --workers=1 --retries=0 --reporter=list,junit
```

On macOS the browser install does not exercise Linux apt dependencies. For Linux
parity, run the same commands in the configured image with a fresh checkout. Keep
build/typecheck sequential because both generate `.next/types`. Build and E2E must
use the same checkout; the test config owns its server and refuses an occupied port.

## Production publication (opt-in)

`publication` uses the `production` environment and
`performance-lab-production` resource group. It exists only when
`PUBLICATION_ENABLED=true`, the default branch is protected, and the pipeline is
not an MR pipeline. Leave this flag unset until the handover below is complete.
The code does not create credentials, change settings, push, trigger a pipeline,
collect new measurements or deploy as part of local validation.

Both publication jobs have `needs` on all six required check jobs and the optional
`benchmark-journey`, with automatic artifact fetching disabled. A failed optional benchmark can therefore finish the
DAG without GitLab Runner rejecting a missing artifact archive before our checks.
The CLI lists jobs of **this pipeline**, requires the newest attempt of **each** of `ci-validate`, `lint`, `typecheck`,
`unit-tests`, `build` and `e2e` to be `success`, selects the newest `benchmark-journey` attempt by job ID (never by metric), and
fetches its collection index and raw files through the exact job-ID artifact API.
Redirects to object storage do not receive the GitLab token. It never uses a
branch-based “latest successful artifact” endpoint. It never consumes Lighthouse, bundle, memory, or legacy `benchmark` job artifacts. It does not wait for the other three measurement jobs.

On ordinary protected pushes, the optional manual benchmark does not block pipeline
completion; its dependent publication is skipped until that manual work is activated.
This is GitLab's scheduler-level no-op (no CLI report exists for a skipped job).
When the manual benchmark runs, its dependent publication runs automatically; schedules
with `RUN_BENCHMARKS=true` follow the same path without clicks. This follows GitLab’s documented [manual needs behavior](https://about.gitlab.com/blog/dag-manual-fix/);
verify this DAG in authenticated server lint and a sandbox pipeline before enabling production. `needs:optional` tolerates an omitted job,
not an absent artifact. The CLI itself distinguishes `benchmark-absent`, `manual`,
`skipped`, `running`, `canceled`, and `benchmark-artifacts-absent`; none deploys.
`success` is the only benchmark status allowed to proceed to artifact validation.
A failed job never publishes, even if its artifact claims success.

A missing index (for example preflight failed before collection started) is no-op.
Missing referenced files, malformed JSON, wrong metadata, a wrong summary median,
duplicate identity, failed or incomplete summaries are errors and fail publication.
Both approaches must have exactly five successful distinct iterations from the
manifest's alternating schedule. The importer recomputes both medians from raw
values and compares all summary counts, units, paths and medians. It validates the
pinned profile, every observed environment, readiness policy, clean source commit,
lock hash, production build and a checksum recomputed with the dataset generator.
Standalone single-route, dirty-source, legacy artifacts without pipeline/job
provenance, Lighthouse and memory collections are not accepted by this importer.
No failed or partial collection is converted into a measured result. The existing
`image-font-delivery` scenario maps to the `image-font` experiment; `default` has
no experiment definition and is rejected.

Before importing new data, publication restores the snapshot served by the current
production URL, verifies historical evidence hashes, and merges it with checked-in
records. Missing or conflicting historical evidence blocks publication, preventing a
later single-experiment import from deleting earlier results. All run collections
remain visible separately in Case Study; no “best run” selection or cross-environment
pairing occurs. The snapshot and minimal evidence travel with each deployment, so
future publications do not depend on expired GitLab artifacts.

The workflow follows the official Vercel commands:
`pull --yes --environment=production` → `build --prod` →
`deploy --prebuilt --prod --skip-domain` → `promote URL`.
The exact CLI version is pinned in `scripts/publication/cli.ts` (59.16.0); review
version changes explicitly. `npm exec --package=vercel@59.16.0` installs the tool in
npm's tool cache, not the application dependency graph. The transitive tool graph
is not lockfile-pinned; provision a verified tool image if that stronger guarantee
is required. Application package/lockfiles are unchanged.

The build imports JSON records into the registry. Narrow Next file tracing includes
`public/evidence/**/*` and the records JSON only for `/api/case-study`. After Vercel
build, `verify-output.ts` checks the static snapshot, every evidence checksum in
static output, and the records/evidence available to the Case Study server function.
A missing/different file or unexpected function layout fails before deploy. Actual
Vercel bundle layout and hosted API/evidence links still need account-backed validation.
No `.vercel` configuration, pulled variables, source patches, error logs or full
environment dumps enter the public evidence snapshot or publication artifacts.
Only a fixed allowlist of JSON files is downloaded via the exact job-file API;
no ZIP/tar extraction is performed. Paths, symlinks, HTTPS redirects and response
sizes are checked. Downloaded inputs live in a temporary directory removed on exit;
only normalized evidence is retained by publication. GitLab tokens are stripped on
all redirects. Known credential values are rejected in publication data and scanned
in provider output before deploy. Secret-named variables from Vercel pull are also
scanned; public credential variable names are rejected. Provider subprocess output
is never logged.

The resource group serializes CI publications. The CLI additionally checks branch
HEAD and the highest pipeline ID for that branch before history restoration, before import, before staging,
and before promotion. A newer pending or failed pipeline supersedes an older one
conservatively. `--skip-domain` ensures staging itself does not replace production.
The last freshness check and promotion execute while holding the resource group;
all production writers must use this group. Disallow external Git/CLI promotions
or the serialization guarantee no longer applies. If staging succeeds but freshness
changes, the report retains the unpromoted URL. Provider errors are suppressed from
logs/reports to avoid echoing secrets; a failed promotion can require checking
Vercel's actual domain state before retry because a provider timeout is ambiguous.

### Required settings and credentials

Configure these in GitLab, not in files. Secret variables must be **protected,
masked/hidden, environment-scoped to `production`**, with variable expansion off.
The environment scope is essential: protected flags alone can expose values to
other jobs on protected branches. Disable protected-variable access for MR pipelines,
protect the production environment and restrict deploy permissions to maintainers.

| Variable                             | Purpose                                                                                                                                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VERCEL_TOKEN`                       | Team-scoped credential allowed to pull/build/deploy/promote this project.                                                                                                                                   |
| `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Existing Vercel team and project identifiers; protected production scope.                                                                                                                                   |
| `GITLAB_PUBLICATION_READ_TOKEN`      | Project access token with `read_api`, sufficient role to list pipeline jobs, branches/pipelines and download this project's artifacts; no write scope. `CI_JOB_TOKEN` does not provide every API used here. |
| `PUBLICATION_PRODUCTION_URL`         | Canonical HTTPS production origin serving public `/evidence/` directly, without authentication or redirects. No credentials in this URL.                                                                    |
| `PUBLICATION_INITIAL_DEPLOYMENT`     | Set `true` for the first handover only when no snapshot exists. Remove immediately after the first successful publication; later missing snapshots must fail closed.                                        |
| `PUBLICATION_ENABLED`                | Protected project-level opt-in used by YAML rules; keep unset until handover. Do not environment-scope this rule variable because rules are evaluated before the environment job runs.                      |
| `RUN_BENCHMARKS`                     | `true` on a protected default-branch schedule to collect and publish automatically. Memory uses its separate existing flag.                                                                                 |

GitLab supplies `CI`, `CI_API_V4_URL`, `CI_PROJECT_ID`, `CI_PIPELINE_ID`,
`CI_COMMIT_SHA`, `CI_COMMIT_BRANCH`, `CI_DEFAULT_BRANCH`, `CI_COMMIT_REF_PROTECTED`,
`CI_PIPELINE_SOURCE` and `CI_ENVIRONMENT_NAME` automatically; do not override them.
The environment name must be `production`. `BENCHMARK_EXPERIMENT` retains its
existing `large-list` default; the job ID is selected via the pipeline jobs API.

Use a dedicated protected runner for benchmark and verify Node/browser prerequisites.
Publication now uses the same tagged self-hosted Docker runner; it needs GitLab/npm/Vercel HTTPS
access and the public production origin. Vercel project framework/root/build settings
must match this Next app. Do not define deployment credentials with `NEXT_PUBLIC_`
names or inject unrelated secret environment variables into this demonstration app.

### Transfer production ownership to CI

1. Create/select the Vercel project, configure production domains and the variables
   above, and leave `PUBLICATION_ENABLED` unset. Confirm the production evidence
   origin is readable (404 is acceptable only during explicit first bootstrap).
2. Disconnect Vercel's Git integration for this project, or disable its production
   deployments using the project controls. Cancel already queued Git deployments.
   Do not leave a push-triggered Vercel build that would publish the checked-in empty
   registry. If retaining previews, verify the production branch is excluded.
3. In GitLab Pipeline Editor, run authenticated CI Lint with manual/scheduled/push/MR
   cases, then verify the DAG and exact-job artifact APIs in a nonproduction project.
   Confirm MR and untrusted branch jobs cannot access production-scoped credentials.
4. Verify the prebuilt server function can return the imported run via
   `/api/case-study`, and every evidence link matches its SHA-256. Local output
   checks are mandatory but are not hosted Vercel verification.
5. Once these checks and evidence retention ownership are accepted, set the opt-in
   flag. For the first deployment set the bootstrap flag; remove it afterwards.
   No settings in this list were applied by this repository change.

### Dry-run, traceability, retention and rollback

The `publication-dry-run` job can validate a real CI artifact while
`PUBLICATION_ENABLED` remains unset. Set `PUBLICATION_DRY_RUN=true` only for the
test pipeline (or as a protected project variable with scope `*`, because rules
are evaluated before environment selection). This flag suppresses the deployment
job even if both flags are set. The CLI also refuses a non-dry invocation while
this flag is set. No flag is enabled by the repository.

After reviewing and pushing this code to the protected default branch:

1. Open GitLab **Build → Pipelines → New pipeline**, select the default branch,
   and add pipeline variable `PUBLICATION_DRY_RUN=true`. Do not enable publication.
2. Let all six check jobs pass, then click Play on the manual `benchmark-journey` job in that
   same pipeline. A web-triggered pipeline still needs this click; `RUN_BENCHMARKS`
   automatically starts benchmark only for schedules. A dedicated runner with the
   existing `performance-lab-dedicated` tag must be available.
3. After benchmark succeeds with five baseline and five optimized iterations,
   `publication-dry-run` validates the exact job artifacts. Memory is independent.
4. Download its `reports/publication.json` and `reports/publication-import.json`:
   both must have `status: validated`. A green job reporting `not-deployed` is a
   no-op, not successful artifact validation; inspect its `reason`. A failed job
   records the failing phase without exposing credential values.

The job uses environment `production` with `action: verify` to access the scoped
read token without creating a deployment ([GitLab environment actions](https://docs.gitlab.com/ci/environments/)).
It never invokes Vercel, builds the imported UI, reads production history, or
changes UI data. Thus it verifies GitLab access and artifact eligibility; Vercel
credentials, history restoration, provider output and hosting require the separate
nonproduction validation described above. Code must exist on GitLab first; this
local implementation does not commit, push or start a remote pipeline.

Use a clean disposable checkout of the collection's source commit and its lockfile;
install dependencies with the existing locked install. Download the exact benchmark
job's artifacts through GitLab and locate `artifacts/publication/index.json` or its
`artifacts/benchmarks/<collectionId>/manifest.json`. Do not run a new collection.
Resolve any symlink in the parent directory first (for example use its physical
absolute path on macOS), because the importer rejects symlink components.

```sh
node scripts/benchmark/import-cli.ts /absolute/collection/directory --dry-run
# In the disposable checkout only, omit --dry-run to build the imported records:
node scripts/benchmark/import-cli.ts /absolute/collection/directory
npm run build
```

The importer CLI is implemented and can run locally without GitLab or Vercel
credentials. It checks the local HEAD and lockfile against the manifest. Outside CI,
pipeline/job identity comes from the manifest; independently set `CI_PIPELINE_ID`
and `BENCHMARK_JOB_ID` to verify the expected downloaded job. This local mode does
not independently query GitLab job status. The publication CLI always verifies
job success and all identity fields against GitLab's current pipeline.

```sh
# CI-side dry-run: same protected/default-branch/production gates and GitLab read token.
# Validates downloaded inputs; does not need Vercel credentials or fetch production.
node scripts/publication/cli.ts --dry-run
```

Importer dry-run validates and checks conflicts but writes only `reports/publication-import.json`.
On failure, that report includes `phase` (`manifest`, `checkout`, `lockfile`,
`validation`, `credential-scan` or `import`, with `arguments` for invalid CLI usage)
and a sanitized `check` label. The CLI prints those same fields; it never prints
raw provider/JSON/filesystem exception text. For example, `phase=validation` with
`check=provenance mismatch` identifies an identity failure, while
`phase=credential-scan` identifies the credential guard. Missing files report
`ENOENT` and malformed JSON reports `malformed-json`.

GitLab Runner metadata flags such as `FF_GIT_URLS_WITHOUT_TOKENS`,
`FF_MASK_ALL_DEFAULT_TOKENS`, `FF_DISABLE_AUTOMATIC_TOKEN_ROTATION` and
`FF_SECRET_RESOLVING_FAILS_IF_MISSING` are not credentials. Their boolean values
are excluded from the credential scan, as is `CI_JOB_TOKEN_SCOPE_ENABLED`;
real token values remain checked regardless of length. Do not change Runner flags
to bypass import validation. See [Runner feature flags](https://docs.gitlab.com/runner/configuration/feature-flags/).

Publication dry-run also writes `reports/publication.json`; it deliberately does not
restore or validate production history. Neither changes UI data nor deploys.
It does not pull Vercel settings or touch production. Synthetic unit/browser fixtures
stay outside the production registry; the checked-in published-runs JSON is empty.

The public snapshot is `public/evidence/publication-snapshot.json`; collection
samples are `public/evidence/ci-<pipeline>-<job>-<collection>/journey.json`.
`published-runs.json` is updated only in the disposable checkout before build;
no job commits generated files to Git. Generated evidence is ignored by Git.
`reports/publication.json` records status, the last phase, run ID and staged URL
when available. Nonzero CLI exit means validation, history, build, output or provider
failure: inspect the phase and private original benchmark artifacts, fix the cause,
then use a new pipeline. Provider exception text is intentionally suppressed.
Validation/build/output failures cannot call deploy/promote and leave the existing
deployment untouched. A timeout during promote requires checking the provider's
actual domain state before retry.

Publication failure reports include a safe `check` label. `phase: "pull"` means
Vercel CLI execution; `phase: "pull-secrets"` means validation of the downloaded
environment. Known process/npm failures have fixed codes such as `provider-ENOENT`
(missing executable), `provider-ETARGET` (package version resolution), or
`provider-ENOTFOUND` (DNS). `provider-command-failed` is an unclassified provider
failure, not proof of invalid credentials. The classifier also recognizes fixed
Vercel messages for token rejection, scope access and unavailable project settings,
plus Node module and TLS certificate failures, from either output stream. These
labels describe the CLI response, not an independent diagnosis of account settings.
Raw provider output remains suppressed.
Build failures also expose safe `exitCode` and `signal` fields (null if unavailable),
and fixed `provider-build-*` categories for TypeScript, missing dependencies,
configuration, prerendering, compilation, memory errors and command-exit wrappers.
A generic category does not establish a root cause. A `SIGKILL` signal alone does
not prove out-of-memory; check runner/container resource evidence separately.
No raw build output, source excerpts, commands or URLs are included in the report.


Collection identity is the run heading on Case Study, the public journey JSON, the
source manifest/index, and Vercel deployment metadata (`sourceCommit`, `collectionId`,
`pipelineId`). The publication job retains `reports/publication.json`, import report,
snapshot and `public/evidence/` for 30 days with maintainer
artifact access. The benchmark's original full artifacts, including failed collections,
are retained by its unchanged artifact policy; publication never edits/deletes them.
The app itself reads its bundle only and never calls GitLab.

Assign a retention owner before enabling production. Copy the original benchmark
archive, reports, normalized snapshot/evidence and immutable deployment URL to durable
versioned storage before the 30-day expiration. Public evidence is deliberately
minimal: allowlisted conditions/build metadata, readiness/schedule, sample identities,
raw timing values and phase timings from the complete successful collection. Diagnostic errors,
patches and executable paths remain in private original artifacts. SHA-256/schema
validation does not prove scientific correctness, parity or statistical significance;
the common drawer journey does not exercise every experiment-specific workload.
Memory needs a separate publication/review protocol, and Lighthouse is not imported.

For rollback, disable the publication flag and wait for any active publication to
finish; identify the previous immutable deployment and its archived evidence. Use
Vercel's rollback/promotion controls under the same production ownership lock, verify
Case Study and links, and record the rollback externally. Before re-enabling CI, restore
any evidence added after that rollback into the next workspace/snapshot from the durable
archive so historical collections are not lost. A new pipeline is required after a
published pipeline; rerunning the same pipeline is deliberately blocked by snapshot
monotonicity. Do not “fix” a failed collection by overwriting its raw files.

References: [Vercel build](https://vercel.com/docs/cli/build),
[Vercel deploy and skip-domain](https://vercel.com/docs/cli/deploy),
[Vercel promote](https://vercel.com/docs/cli/promote),
[GitLab job control](https://docs.gitlab.com/ci/jobs/job_control/),
[exact job artifacts](https://docs.gitlab.com/api/job_artifacts/), and
[Jobs API](https://docs.gitlab.com/api/jobs/). Local `npm run ci:validate` parses YAML
and asserts repository invariants; it does **not** replace authenticated GitLab CI Lint
or actual runner/Vercel execution.
