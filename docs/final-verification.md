# Frontend Performance Lab readiness — 2026-09-12

**Local deterministic correctness: ready within the tested scope. Performance
publication and remote CI readiness: not yet verified/approved.**

This audit began with read-only inspection. It covers the working tree based on
commit `695ce1fba9862d846fd32ddcde7c71afc2875960`, including existing uncommitted and
untracked work; it is not verification of a clean committed release. No commit,
push, run promotion, expensive benchmark or new measurement was performed.

## Passed checks

| Check                                                | Result                                                                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Clean dependency install                             | Node 24.19.0 / Yarn 1.22.22, macOS arm64; fresh temporary directory, frozen lockfile, install scripts enabled                                    |
| Resolution reproducibility                           | Lockfile unchanged; all 728 lock entries in the clean install match the workspace integrity record                                               |
| `yarn lint`                                          | Passed                                                                                                                                           |
| `yarn format:check`                                  | Passed after the limited formatting fixes below                                                                                                  |
| `yarn typecheck`                                     | Passed                                                                                                                                           |
| `yarn test`                                          | 344 tests passed across 34 files                                                                                                                 |
| `yarn build`                                         | Production build passed                                                                                                                          |
| `yarn test:e2e --workers=1 --retries=0`              | 52 passed; no retries or skipped tests                                                                                                           |
| `yarn ci:validate`                                   | YAML parsing and local repository invariants passed; not GitLab server lint                                                                      |
| `yarn memory:validate` with existing smoke directory | Raw schema and stored SHA-256 receipt passed; no browser journey executed                                                                        |
| Registry evaluation                                  | 10 definitions, 10 validated runs, 0 measured results, 20 unavailable results                                                                    |
| Case study                                           | 0 published measurements; populated/partial/unavailable behavior covered by synthetic transport fixtures                                         |
| Evidence references                                  | 125 explicit measured evidence references resolve to existing files; all three benchmark summaries retain their raw inputs                       |
| Lighthouse report audit                              | Five original reports revalidated against the pinned parser/environment policy; six medians independently recomputed from their raw audit values |
| Working-tree review                                  | `git diff --check` passed; unrelated changes preserved                                                                                           |

Lockfile SHA-256:
`7d9a81dfed97b2051f8492093c1edde7b42d4acbc8eba44c4500698779ee8cc6`.
A cold offline install initially failed because the local cache lacked packages.
The clean online frozen install passed. Offline/air-gapped reproducibility is not
claimed. Yarn reported a transitive OpenTelemetry peer warning and two
third-party-web aliases sharing the same destination; both aliases resolve to the
same pinned 0.29.2 integrity entry. No dependencies were changed for this audit.

## Behavioral contract and isolation

Desktop/mobile parity tests pass for shared data, search/filter/sort, expansion,
drawer/focus, refresh and asynchronous states. The suite also covers deterministic
scenario validation, full versus virtualized lists, search races, worker equivalence
and cleanup, render boundaries, finite request lifecycle, chart delivery, image/font
isolation, bounded interval/listener/detached-node behavior and reduced motion.
Scenario-specific branches select these implementations explicitly; generator/API
contracts remain shared. These checks establish functional reproducibility for the
covered workloads, not stable timing across machines or all possible interactions.

The case-study pipeline validates records before transformation and verifies public
artifact checksums before showing measurements. It does not join measurements from
different runs/environments. Units/extraction boundaries must match for percentages;
zero baselines have no percentage. Lab navigation metrics and synthetic drawer
journey durations remain distinct. INP is excluded without field/RUM provenance.
The investigation registry remains empty; no AI investigation was fabricated.

## Blockers and unverified measurements

- There is **no reviewed paired performance comparison in the registry**. All 20
  planned results correctly remain unavailable. Evidence integrity alone does not
  establish extraction correctness, parity of a particular measured run or causality.
- The existing [large-list journey collection](../artifacts/benchmarks/2026-09-12T11-13-15-932Z-2ac19fd0-f86c-4eee-9e53-df9fdf3e20bd/summary.json)
  retains five baseline readiness timeouts and five completed optimized iterations.
  Baseline median is unavailable; this collection cannot support a speedup claim.
- The [completed Lighthouse collection](../artifacts/benchmarks/2026-09-12T12-53-25-941Z-c81c85fe-a0ce-4df1-b478-8e8f0da57482/summary.json)
  contains five optimized navigations only. Original JSON/HTML files exist, but no
  matched baseline Lighthouse set or field INP evidence exists. The prior locale-failed
  collection is retained separately and is not substituted into the valid set.
- [Memory smoke evidence](../artifacts/memory/20260912-detached-smoke/validation.json)
  validates, but uses three records and ten cycles per route with the diagnostic
  viewport/unthrottled policy. It is not the five-run, 5,000-record comparison and
  does not establish retained-heap improvement or a reviewed browser heap claim.
- The old [bundle report](../artifacts/bundle-loading/report.json) retains asset
  paths/hashes and derived decoded/gzip sizes, but not original JS asset bodies from
  its build. Those bytes cannot be independently reconstructed from that report
  after subsequent builds; do not promote it as fully verified publication evidence.
- No normalized, approved regression-budget comparison is available. Missing budget
  data remains unavailable/invalid, not pass.
- Remote GitLab CI/Linux image execution, dedicated runner isolation and deployment
  hosting are unverified. The earlier GitLab CI Lint attempt returned 403; merge-on-
  pipeline-success was not enabled. See [CI setup](ci.md). This audit did not change
  remote project settings or rerun expensive collectors.

## Limited fixes and documentation review

Corrected stale placeholder/deferred-implementation statements in README, project
scope and architecture. Formatted only the five files reported by Prettier (README,
architecture, benchmark protocol, behavioral contract and the existing page test);
no application logic or test assertions were changed. Added collected artifacts,
CI reports and dependency cache to `.prettierignore` so formatting commands cannot
rewrite immutable evidence. This report is the only new documentation artifact.

README now covers pinned setup, commands, API/data, each scenario, benchmark/preflight,
Lighthouse, evidence validation, relative budgets, case-study provenance, AI logs,
CI and limitations. Detailed protocols remain linked rather than embedding invented
measurements. The older AGENTS.md stack description remains preserved and its
mismatch with the requested Next.js/Yarn stack is explained in README.

## Next actions

1. Review and commit the intended working-tree changes; run authenticated GitLab
   CI Lint and the correctness pipeline on the pinned Linux image, then enable the
   required merge gate and provision/validate dedicated measurement hardware.
2. Before any publication, review a fixed measurement plan. Diagnose the retained
   baseline timeout separately; collect a new complete paired set only when requested
   and after preflight, without replacing the failed runs.
3. Retain original build assets, raw reports/traces, source/diff and comparable
   environment metadata. Review extraction and evidence, then deliberately register
   verified runs. Keep all other measurements and field INP unavailable.
