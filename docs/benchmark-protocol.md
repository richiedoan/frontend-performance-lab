# Benchmark protocol

## Status and scope

This is the required protocol for future controlled lab measurements of the
[Live Market Explorer](project-scope.md). Diagnostic collectors exist, but no reviewed benchmark comparison is published.
Current unit tests and smoke collections verify tooling/correctness only.

Each isolated experiment must identify one primary implementation variable, its
hypothesis, and the expected mechanism before collection. Record the exact changes
and supporting edits. A batch of independent optimizations is not an isolated
experiment. An experiment must pass feature and observable-behavior parity checks
before its performance results can support a claim.

## Freeze the conditions

Create an experiment manifest before measurement. Fix the following across both
variants and all five runs in each measurement set:

| Condition           | Required record                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Source and build    | Commit plus any dirty patch, lockfile identity, build command and mode, build identifier, variant, primary variable     |
| Runtime             | Node version and Yarn Classic version (1.22.22); exact browser, automation, and instrumentation versions                |
| Machine             | OS, CPU, memory, power mode, and relevant background workload controls                                                  |
| Browser             | Viewport, device scale, fresh profile policy, extensions, and headless/headed mode                                      |
| Resource conditions | CPU and network throttling values, or explicit absence of throttling                                                    |
| Cache and startup   | Cold/warm cache policy, reload/reset procedure, and any fixed warm-up sequence                                          |
| Dataset             | 5,000 records, seed 20260911, generator version, schema version, and dataset checksum                                   |
| Scenario            | Initial state, deterministic update schedule, exact actions and timing, readiness condition, and measurement boundaries |
| Metrics             | Name, unit, collector, start/end semantics, per-run extraction rule, and collection overhead                            |
| Execution           | Predetermined variant order, run identifiers, validity criteria, and artifact destination                               |

Use a production build (`yarn build`, served with `yarn start`), never the
development server. Run measurements sequentially on the same controlled machine;
do not use the existing parallel smoke-test execution as a benchmark. Preserve the
same instrumentation in both variants. Fix scenario scheduling independently of
wall-clock randomness and user input.

The versioned mobile environment below fixes throttling and startup policy.
Machine controls, metric boundaries and scenario scripts must still be recorded. Record them before collecting a result;
“default settings” is not a sufficient environment description. Different condition
sets require separate results and must not be pooled.

## Collection procedure

1. Define and review the experiment, invariant checks, manifest, metric extraction,
   and run-validity rules before seeing measurements.
2. Verify baseline and optimized have identical UI, data, features, accessibility,
   and observable behavior for the scenario. Record the checks and their outcome.
3. Build the exact source revision. Capture any dirty patch so the measured source
   can be reconstructed. Do not change source, dependencies, or settings mid-set.
4. Execute the predetermined schedule for both variants. Alternate variant order
   using a recorded schedule to reduce systematic order effects. Reset state and
   caches according to the fixed policy before every run; keep prescribed warm-up
   outside the measured interval.
5. Collect raw artifacts, environment metadata, and one extracted value per metric
   per run. Preserve every attempted run, including failures, exclusions, and
   retries. Stop any unrelated test activity during collection.
6. Collect **five valid runs per variant, per scenario, per condition set**. A valid
   run completes the prescribed actions, passes parity/readiness checks, and has
   complete, parseable required evidence without a known protocol violation.
7. Derive and review results under the [evidence policy](evidence-policy.md). If
   either variant lacks five valid runs, its comparison remains unavailable.

Exclude runs only for predefined technical reasons such as collector failure,
incorrect workload, incomplete actions, or a documented environment violation.
Log the reason and collect a replacement under the same conditions. Do not exclude
slow runs simply because they are slow or inconvenient. If conditions change,
start a new measurement set; do not combine runs across sets.

## Aggregation and interpretation

For each metric, sort the five valid per-run values and report the third value:
the **median of five valid runs**. Retain all five values and their raw evidence
links. Define any within-run aggregation before collection; do not silently pool
all samples from all runs into one median. Use unrounded values for calculations
and declare display rounding. Do not report the best run as representative.

If publishing a relative change, link both medians and show the formula, direction,
and units. For a lower-is-better metric, percent reduction is
`100 × (baseline median − optimized median) / baseline median`; a zero baseline
makes this percentage unavailable. Do not average per-run percentages in place of
this defined calculation. Report regressions and unchanged results as well as
improvements. Five runs alone do not justify a statistical-significance claim.

Label measurements as **lab** metrics with their actual collection method, such
as “lab interaction duration” with explicitly defined boundaries. Do not label
synthetic timings, automated interactions, or lab tooling output as **field INP**.
This project currently has no field measurement collection; field INP is unavailable.
Any future field claim requires a separately defined field collection and analysis
protocol and its own evidence, rather than relabeling a lab metric.

## Pinned mobile environment (mobile-cold-v1)

`benchmark/profile.json` is the machine-readable condition set;
`benchmark/environment.schema.json` describes the generated observation artifact,
and `scripts/benchmark/environment.ts` validates critical matches. Pins are Node
24.19.0 (`.nvmrc`, package engines), Yarn Classic 1.22.22, Playwright 1.63.0 as resolved
by `yarn.lock`, and full Chrome for Testing 153.0.8010.12, Playwright revision 1243.
The installed Playwright browser manifest identifies this distribution. Preflight
launches that explicit executable, checks its actual version and records its hash;
it never silently switches to regular Chrome or the default headless-shell binary.
CfT is intended for version-pinned automation; see the
[official Chrome for Testing documentation](https://developer.chrome.com/docs/automation-and-testing/chrome-for-testing).

Setup: `nvm install && nvm use`, use Yarn 1.22.22, then `yarn install --frozen-lockfile`
and `yarn playwright install chromium`. The checked-in lockfile plus profile pins
must remain consistent; no browser download occurs during preflight. On unsupported
platforms or missing binaries, preflight fails with a reason instead of claiming a
compatible environment. Deliberate version upgrades require a new profile/review.

| Setting                 | Fixed value                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Viewport / device scale | 390×844 CSS px / 1; desktop browser at mobile-sized viewport, not device emulation    |
| Browser                 | full CfT, headless, fresh nonpersistent context, service workers blocked              |
| Locale / timezone       | en-US / UTC                                                                           |
| CPU                     | CDP 4× slowdown relative to the host CPU                                              |
| Network                 | 150 ms latency, 200,000 bytes/s down (1.6 Mbps), 75,000 bytes/s up (0.6 Mbps), online |
| Cache                   | cleared, disabled throughout each iteration; fresh context per iteration              |
| Dataset                 | seed 20260911, exactly 5,000 records; generator version and checksum recorded         |
| Measured iterations     | 5 per approach, sequential; no warm-up iterations; alternate approach order as above  |

Run `yarn benchmark:preflight`. Optional `BENCHMARK_ENV_OUTPUT` sets a new output
directory (default `artifacts/environment/<timestamp>`); existing directories are
refused. The command launches only a blank benchmark browser page and generates the
dataset in Node. It runs **no application journey, forced GC, measured iteration or
benchmark comparison**. `environment.json` records actual Node/Yarn/browser versions,
viewport, storage state, commit SHA, dirty status and OS/CPU/RAM metadata. Source patch
and an untracked-file hash inventory accompany it. Critical mismatches produce a
failed artifact and nonzero exit; there is no allow-mismatch switch.

CPU, network, cache and service-worker policies are configured in the owned browser
context. CDP acknowledgements and the observed viewport/storage/online state are
recorded separately. CDP has no portable independent getter for physical CPU
slowdown or effective throughput: acknowledgement is not calibration, and no speed
measurement is invented. CPU power/thermal state and background workload still need
operator control on the same machine. Dirty source is allowed only as explicitly
reported provenance, not a declaration that a release build is reproducible.

The five-iteration field is a validated **plan**, not five executed runs. Every
future measured iteration must recreate this context/configuration and verify its
own observations; a preflight artifact is not transferable to an arbitrary already
running browser. The earlier `memory:journey` remains a diagnostic collector with
its documented 1280×720/unthrottled conditions and ten drawer cycles. It is **not** a
mobile-cold-v1 comparison runner. No existing memory artifact or run registry is
relabeled or promoted by preflight.

## Production runner

- `yarn benchmark large-list --route=baseline`
- `yarn benchmark large-list --route=optimized`
- `yarn benchmark:compare large-list`
- Append `--dry-run` to any command to generate only a manifest and an explicit
  unavailable summary. No build, server, Chrome or metric runs in dry mode.

The experiment argument accepts the existing scenario names (including `default`).
This first runner measures one common **Dashboard → Detail → Dashboard** journey:
start the Node monotonic clock immediately before navigation, wait for the table
and first stable record, open its drawer, wait for the chart, close the drawer,
and verify focus restoration before stopping the clock. The metric is milliseconds
including automation, browser work and network waits; it is not field INP, LCP,
CLS or a heap measurement. Scenario-specific typing, leak cycles and aggregation
completion benchmarks are not inferred from this common journey.

Real collection runs preflight, then `yarn build`, then owns a production server on
127.0.0.1:3101 (refuses an occupied server). It never reuses a dev server. Each of five
iterations per route launches a fresh pinned full Chrome browser/context and applies
mobile-cold-v1 CPU/network/cache settings before timing. Warm-up is **zero**, as
specified by that profile. Server readiness is outside timing. Compare alternates
baseline/optimized then optimized/baseline for successive pairs, sequentially in
one process and one build. Standalone route runs are not automatically equivalent
to a paired comparison.

Output defaults to `artifacts/benchmarks/<timestamp>-<UUID>/`; set
`BENCHMARK_OUTPUT_ROOT` to use a temporary directory. Exclusive directory/file
creation prevents overwriting. `manifest.json` freezes the profile, schedule and
metric; `environment/` holds preflight provenance, `build.json` identifies the
production build/lockfile, and build/preflight/server logs remain beside raw
`<route>-<iteration>.json` files. `summary.json` links every raw input and records
unit, median aggregation, successful/expected sample counts. No outlier is removed.
An iteration failure is recorded and later scheduled iterations still run. Setup
failure produces explicit failed records for every unexecuted slot. Any failed or
missing iteration makes that route's median unavailable and the command exits
nonzero. External termination can leave an incomplete directory; a missing summary
must never be treated as a successful run. Nothing promotes experiment run records
or publishes a speedup automatically. Do not run concurrent collectors/builds or
edit source during collection; control power, thermal state and background load.

Journey readiness policy `dataset-then-table-v1` allows 90 seconds for navigation
and completion of both dataset response bodies, then 90 seconds for table
readiness. Row/chart/actions remain 60 seconds and the whole collection 30 minutes.
Both routes use this policy, recorded in the manifest, raw iterations and summary;
raw iterations also record the last phase and elapsed dataset/table/journey times.
The measurement clock still starts before navigation, including all network and
rendering waits. These limits are failure bounds, not performance targets.
Previously, the table's 90-second wait also included dataset transfer: a local
diagnostic probe observed collection completion around 52 seconds and all 5,000
baseline rows around 134 seconds with the pinned throttling. That probe is not a
five-sample measurement or a published comparison. The first tooling collection
(`artifacts/benchmarks/2026-09-12T11-13-15-932Z-2ac19fd0-f86c-4eee-9e53-df9fdf3e20bd/summary.json`)
retains all ten raw inputs: five baseline table-readiness timeouts and five completed
optimized iterations. Its overall status is failed and baseline median unavailable.
This is not a successful comparison or a speedup claim. Any future timeout-policy
change must be declared before a new complete collection; do not replace these
failed inputs with reruns. The new readiness policy applies only to new collections;
the earlier failed records and unavailable medians remain unchanged. A slower
runner can still exceed these bounds and must retain that failure.

## Lighthouse navigation collector

Use `yarn benchmark large-list --route=baseline --lighthouse`, the equivalent
`--route=optimized`, or `yarn benchmark:compare large-list --lighthouse`.
`--dry-run` remains plan-only. This opt-in collector replaces the drawer journey
for that collection, using the same production build/preflight gate, five-iteration
schedule, zero warm-up, fresh browser and mobile-cold-v1 dataset/viewport policy.
Only a passing preflight permits Chrome audits. Lighthouse 13.4.1 and Puppeteer
Core 25.10.0 are pinned; the Chrome executable remains the preflight-verified CfT.

CPU/network use Lighthouse `devtools` throttling, not simulated scores. CPU is 4×,
request latency 150 ms. Lighthouse's Ki-bit conversion is explicitly inverted:
`downloadThroughputKbps=200000*8/1024`, `uploadThroughputKbps=75000*8/1024`.
The resulting CDP rates are exactly 200000/75000 bytes/s. `provided` is unsuitable
for this pinned version because its implementation clears network throttling.
Screen/user-agent emulation is disabled: the owned browser already has 390×844,
DPR 1, desktop UA, UTC and en-US. A fresh browser has no persisted site storage;
cache is cleared then disabled, service workers bypassed. `disableStorageReset`
is true to prevent Lighthouse's reset routine re-enabling the disabled cache.
These acknowledgements do not calibrate physical CPU or effective network speed.
See [Lighthouse integration documentation](https://github.com/GoogleChrome/lighthouse/blob/main/docs/puppeteer.md).

Each iteration preserves original `<route>-<n>-lighthouse.json` and `.html` reports
before parsing, including report-level errors when Lighthouse returns a report.
Raw `<route>-<n>.json` records observed configuration, failures and metric evidence
paths. If launch/audit throws before producing a report, no fake report is created.
Original reports retain JS execution breakdown (`bootup-time` details), network
request data and warnings. The six parsed metrics are LCP (ms), CLS (unitless),
TBT (ms), Speed Index (ms), total transfer size (bytes, `total-byte-weight`), and
JS bootup time (ms, `bootup-time`, including script parse/compile/evaluation).
These are lab navigation metrics, not complete-session or worker CPU measurements.

Each metric requires five valid distinct samples for a median. Missing, errored,
wrong-unit, negative or nonfinite audit values remain `not-available` with reasons;
no zero substitution or outlier deletion occurs. Version, URL and report policy
mismatches invalidate parsing. **Field INP is always not-available without RUM
evidence**; neither TBT nor the separate synthetic drawer duration is called INP.
Fixtures exist only in unit tests and are explicitly synthetic. Real collections
are labeled `evidenceKind: real`; they are not automatically promoted to run records.
Lighthouse may finish before asynchronous dashboard work settles, and its audit
window does not exercise every scenario interaction. Do not pool Lighthouse
navigation values with drawer journey durations or claim a speedup from one route.
