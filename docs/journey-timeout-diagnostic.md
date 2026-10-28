# Journey timeout diagnostic — 2026-09-13

Latest: [alternate Chrome symbol gate](#alternate-chrome-symbol-gate) verified a
matching ARM64 binary/symbol pair for installed Chrome 152.0.7977.83 and resolved
native function names from a bounded about:blank sample. This enables a new browser
branch; application reproduction has not run and old CfT addresses remain unresolved.
Earlier investigations below are historical evidence.

## Outcome

**Reproduced the baseline drawer-click timeout locally. The observed bottleneck is
renderer-main-thread layerization/compositing work around the full table and scroll,
not an observed selection-triggered React update.** Chrome records an 86.955-second
`Layerize` before table readiness and another unfinished `Layerize` after scroll
covering at least 62.657 seconds through trace stop. No pointerdown/click delivery
was observed. The exact CSS/compositor trigger and Docker/CI behavior remain unproven.
No application performance fix, profile/deadline change, collection, median,
publication, or deployment was performed.

## Commands and retained evidence

Executed sequentially from the repository root:

```sh
npm run benchmark:diagnostic -- --dry-run
npm run benchmark:diagnostic
# After an external working-tree change restored the missing publication input:
npm run benchmark:diagnostic
npm run benchmark:diagnostic -- --trace=chrome
# After fixing diagnostic trace writing/cleanup only:
npm run benchmark:diagnostic -- --trace=chrome
```

All paths below are under `artifacts/diagnostics/`:

| ID (directory name)                                             | Result                                                                                                                                        |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `2026-09-13T02-28-50.657Z-2a843c2d-6826-4fc0-9bdd-51fe255eef87` | Dry-run; no browser/build/measurement                                                                                                         |
| `2026-09-13T02-29-00.731Z-e2cdaf7c-de82-40ec-8406-0250eb1b255a` | Preflight passed; build failed on missing `published-runs.json`; dependent journey stopped                                                    |
| `2026-09-13T02-33-59.576Z-f1f4b339-6686-41a8-a31c-9065af72bfc9` | Baseline Playwright probe: click timeout; complete `playwright-trace.zip`, `failure.png`                                                      |
| `2026-09-13T02-38-11.876Z-1b3f4981-dd34-4e69-ae61-e66efdf74676` | Additional probe 1, Chrome instrumentation: click timeout; trace export incomplete (only first 35.3 seconds), screenshot timed out            |
| `2026-09-13T02-43-27.686Z-2348e9d7-dd60-40dd-994f-3dab0602e08e` | Additional probe 2, corrected Chrome writer: click timeout; complete 205.36-second `chrome-trace.json`, `analysis.json`; screenshot timed out |

Each attempted probe retains manifest, preflight environment/source fingerprints,
phase/status JSON and command logs. Executed journeys also retain `build.json`,
`applied.json`, `events.json`, `journey-phases.json`, `server.txt`, and `cleanup.json`.
All journeys remain **incomplete**; a complete trace export does not make a valid
benchmark sample. Drawer/chart/close/focus phases were never reached. No third
additional probe was necessary. No profiles or timing results were pooled.

| Separate diagnostic probe | Navigation | Dataset bodies | Table after bodies |     Detail click |
| ------------------------- | ---------: | -------------: | -----------------: | ---------------: |
| Playwright                |    1.270 s |       51.039 s |           82.633 s | 80.608 s, failed |
| Chrome, incomplete export |    1.247 s |       50.986 s |           89.297 s | 60.003 s, failed |
| Chrome, complete export   |    1.245 s |       51.011 s |           90.984 s | 60.001 s, failed |

These are automation observations, not performance comparison samples. Dataset and
navigation overlap; do not add them. The configured click timeout stayed 60 seconds
and table timeout 90 seconds even where observed completion/reporting was later.
Build IDs are retained independently for each production build; source fingerprints
also capture the diagnostic writer changes. Initial build failure is historical,
not the final blocker: `published-runs.json` appeared externally as `[]` while work
was in progress. This task preserved that unrelated file without editing it; it was later committed externally.

## Environment and provenance

Initial source revision and Playwright probe: `f45248d7229c2b43560b26722eb05deba4160ce2`.
Both Chrome probes: `4aaeec1832203fad0cf82b37f4258d6473aec2f1`, an external commit
made during the task. Its only changes are README and the empty publication input;
no market rendering/profile code changed between these revisions. Per-probe build
IDs and dirty diagnostic fingerprints remain authoritative; runs are not pooled.
Initial working tree was clean. Diagnostic additions are recorded as dirty source;
preflight retains the patch and untracked-file fingerprints. Dependencies and
lockfiles were unchanged; the existing Node/Yarn pins match the profile.

Local: macOS/Darwin 25.5.0, ARM64, 16 GiB RAM; Node 24.19.0, Yarn 1.22.22,
Playwright 1.63.0, full Chrome for Testing 153.0.8010.12/revision 1243. Browser
binary SHA-256 and CPU model are in environment evidence. A later read-only memory
snapshot reported 41% system-wide memory free and 2088.06 MiB swap used; neither
establishes pressure during the reported timeout.

Docker daemon: aarch64, 8 CPUs, 8,319,770,624 bytes RAM. Only
`performance-lab-runner` (`gitlab/gitlab-runner:latest`) was present, with no
Node/Yarn and no surviving job container. Its CPU/memory limits were unrestricted
within the Docker VM (`memory.max=max`, `cpu.max=max 100000`); current pressure
averages were zero and usage about 29 MiB. These are **manager-container** readings,
not historical benchmark-job allocations. CI config specifies
`node:24.19.0-bookworm-slim`, tag `performance-lab-dedicated`, serialized resource
group, and browser installation at job setup. The exact failed runner's build,
revision, resource pressure and browser identity remain unavailable. No Docker
resources or unrelated processes were changed. Local preflight is not CI reproduction.

## Findings and unverified hypotheses

Direct observations and trace-supported inferences:

- Playwright trace (`call@35`) resolves the correct first-row button and reports
  visible/enabled/stable, then completes scroll at trace time 137491.939 ms. It
  times out without a delivered pointerdown/click mark. The failure screenshot
  shows the horizontally scrolled table and visible View details button, with no
  open drawer or evident overlay. It does not prove every possible hit-test defect absent.
- The complete Chrome trace identifies renderer PID 17343 / main TID 1567007.
  `Layerize` at timestamp 95258487865 µs has directly recorded duration
  86954838 µs and thread CPU duration 86890471 µs. This is substantial native
  renderer work, not merely waiting for network or descheduling.
- Scroll User Timing marks occur at 95346556999 and 95346559516 µs. A subsequent
  `Layerize` begins at 95346726358 µs with no end before trace stop. The 62.657-second
  interval to the final trace timestamp is an **inferred lower bound**, not a
  completed span duration. No click/pointerdown mark or corresponding handler
  execution appears before this gap. This supports layerization blocking delivery
  of the click, rather than selection reconciliation or chart creation causing it.
- Initial layout recorded 117536 dirty / 117581 total layout objects. UpdateCounters
  shortly before the stalled span reports about 177748 nodes across documents,
  20330 JS listeners and 56.6 MB JS heap; these are Chrome counters, not React row
  counts or proof of a leak. Completed `Layout` spans total about 0.94 s and `Paint`
  spans about 0.80 s. Completed FunctionCall and major-GC spans are far below the
  86.955 s Layerize. Nested/cross-thread categories must not be summed into a total,
  and these totals cannot describe work inside the unfinished span.
- Collection payload completion takes about 49.7 s from request start in the first
  probe (summary 0.277 s), so throttled network materially affects navigation but
  finishes before table and click stalls. No page errors, failed requests or HTTP
  failures were observed in the three application probes.

Source-supported hypotheses that are **not yet isolated by a control**:

- `BaselineExplorer.tsx` reselects records and passes new callbacks to non-memoized
  `MarketTable.tsx`, which mounts all 5,000 records plus hidden expansion rows.
  This intentionally large DOM can amplify compositor costs. However, selection
  re-render is not the observed trigger because the click has not arrived.
- `src/styles/market.css` combines horizontal overflow, a large collapsed-border
  table, rounded/shadowed table container, and shared button translate/scale/hover
  transitions. These are candidates for the layerization trigger; no individual
  CSS rule has been proven causal. The same shared presentation can become far
  more expensive on the baseline's full list than on the optimized virtual list.
- `DetailDrawer.tsx` opens/focuses via an effect; the chart builds a single polyline
  from 24 points. Neither was reached, so chart cost, focus restoration and drawer
  lifecycle remain untested here. Image decoding may contribute to earlier render
  work; the trace does not establish it as the dominant bottleneck.
- Docker resource pressure and browser-specific compositor behavior remain unknown.
  Current manager-container readings do not establish conditions in the failed job.
  No optimized, record-count, CPU-rate or native/Docker control was executed.

The older local baseline artifact
`artifacts/benchmarks/2026-09-12T11-13-15-932Z-2ac19fd0-f86c-4eee-9e53-df9fdf3e20bd/baseline-1.json`
reports table-not-found timeout without phase timings; it remains separate evidence.

## Runner contract and interpreting future evidence

`npm run benchmark:diagnostic` defaults to one baseline large-list journey at
5,000 records, seed 20260911, CPU ×4, the exact profile network/viewport, fresh
context, cleared/disabled cache and blocked service workers. Preflight and build
run sequentially before the journey. The shared `drawer-journey.ts` preserves the
collector's pointer clicks, first-row selection, assertions, and deadlines;
no explicit extra scroll, forced click, synthetic dispatch, or sleep is introduced.

Each phase saves a wall timestamp, monotonic offset and duration on entry/exit;
unfinished phases remain incomplete. Navigation and dataset-body readiness run
concurrently as in the collector. Events retain response headers/body completion,
page errors, failed requests and HTTP errors. Playwright trace captures internal
scroll/actionability; there is deliberately no invented standalone scroll duration.
DOM capture events and User Timing marks observe event delivery, **not React
handler completion**. Observer callbacks add overhead. Arrival at the Node binding
may lag the browser timestamp, whose time origin is recorded separately.

`--trace=chrome` selects a separate probe with JavaScript sampling, timeline,
layout/paint/GC categories and User Timing marks. It does not simultaneously enable
Playwright tracing. Chrome chunks are appended as received and marked incomplete
on failed trace cleanup; Chrome may buffer events until stop. A hard interruption during export can
leave an unterminated JSON array; the retained prefix is partial evidence.
Playwright ZIP creation
requires successful trace cleanup, so an interrupted run can lack the ZIP while
retaining phase/log evidence. Failure screenshots have a 3-second limit. Cleanup
has bounded trace/browser/server attempts plus a task-owned process-group fallback.
Chrome export gets 30 seconds, other cleanup operations 10 seconds each, within the
parent hard cap. The first Chrome probe used a 10-second export limit and repeatedly
rewrote accumulated events; its incomplete trace motivated append-only writing.
Work deadline is 540 seconds; hard total is 600 seconds including cleanup. Navigation
is 90 seconds, actions 60 seconds, dataset/table 90 seconds each, target/chart
60 seconds, and unspecified visibility/focus assertions retain Playwright's
5-second default. No longer diagnostic deadline was used. SIGINT/SIGTERM and timeout
retain incomplete status; SIGKILL can only leave the last persisted state.

Future reruns use the same commands above. Analyze the first trace before another
probe. Tracing mode/writer changes are instrumentation probes, explicitly distinct
from workload controls. At most three additional probes may be used; this task used
two. The command intentionally exposes no count/CPU override. A future single-factor
control must record its differing profile separately without editing the official profile.

## Smallest next change and collection gate

The smallest next investigation targets `src/styles/market.css`: isolate the
compositing trigger on the table container/shared motion rules before proposing a
specific CSS patch. There is no evidence-based reason to optimize selection state
or replace baseline rows with virtualization to solve this observed pre-click stall.
If a shared visual effect is confirmed causal, change only that effect for **both**
approaches, preserve all baseline records/expansion DOM, pointer semantics, focus,
workload and profile. This would remove an incidental presentation cost while
retaining the intended full-list-versus-virtualized-list comparison. It changes
measurement conditions, so prior results must not be pooled with a new collection.
The exact rule and fairness assessment require a separately authorized follow-up;
no application change was made here. Confirm the external empty publication input
with the importer owner before any official build/publication.

For follow-up validation: run required checks, rerun preflight
on the intended runner, then one baseline diagnostic and inspect the trace. Require
working pointer actions, chart visibility and restored focus with the unchanged
profile/deadlines; compare Chrome evidence only with its declared instrumentation.
Only after diagnosis and any separately authorized fix, clean reproducible source/build,
controlled runner resources, passing checks, and successful untraced journey smoke
validation should a new official collection gather five valid samples per approach.
Keep all failed/partial historical evidence. No median from tracing runs is admissible.

## Validation

Diagnostic orchestration and shared journey fixtures: 6 tests passed, including
phase persistence, abort/timeout partial state, preflight gating, cleanup deadlines,
and unchanged click/assertion sequencing. No test waits through a real long timeout.
Final lint, typecheck and full suite passed (37 files, 358 tests). Production
builds passed after the external publication input appeared; earlier failures remain
in logs. No assertions/configuration were weakened. Real Playwright trace export and
Chrome export were exercised; successful drawer/chart/close/focus remains unverified.
`git diff --check` passed and final status review preserved the unrelated publication file.

## Controlled CSS follow-up

### Conclusion and scope

**Inconclusive at the individual CSS root-cause level.** A new no-override control
reproduced the stall. Removing container radius, changing table border-collapse,
and disabling table-button transitions individually all retained a long initial
Layerize and the post-scroll click timeout. These are negative single-factor tests;
they do not rule out interactions between properties. No production patch is
justified by this series. The renderer layerization bottleneck remains observed
on local macOS ARM64, not reproduced or calibrated on Docker/CI.

Exactly one fresh control and three directed CSS probes were run, sequentially,
with preflight/build before each. No additional CSS/reversal probe was run after
the budget was exhausted, and none was repeated to obtain a pass. No median,
speedup, official collection, Case Study import, publication or deployment occurred.

### Conditions, provenance, and computed styles

All four probes use baseline / large-list / 5,000 records / seed 20260911,
mobile-cold-v1, CPU ×4, 390×844 viewport, cold disabled cache, blocked service workers,
and the unchanged network and pointer journey. They use the same Chrome tracing
categories/export writer and the same computed-style observer. Source revision
`4aaeec1832203fad0cf82b37f4258d6473aec2f1`, dirty-source/lockfile fingerprints,
profile, full Chrome identity/hash, and instrumentation hashes match across all
four manifests/environment artifacts. Each production build has its own recorded ID.

Existing unrelated changes to Overview, tests, `ScenarioGuide.tsx`, and Overview
rules in `market.css` were preserved. Because those source changes and the new CSS
observer differ from the earlier investigation, the old trace was not used as the
experimental control. No production stylesheet was edited by this task.

The default control inserts **no stylesheet**. Treatments append exactly one
style element to the diagnostic document with a named, fixed override; no arbitrary
CSS flag is accepted. Init-script registration happens before navigation. All four
`css-control.json` files report installation during document loading, before the
market dashboard exists, about 0.19–0.21 seconds after the document time origin.
The first-table observer verifies effective styles before its callback disconnects;
pagehide disconnects it if no table arrives. Context/browser cleanup removes the
entire diagnostic document. Nothing is copied into application/public CSS.

In the control, computed container styles are shadow
`rgba(0, 0, 0, 0.04) 0px 8px 30px 0px`, radius `14px`, overflow-x/y `auto`.
Table border-collapse is `collapse`. Buttons have transform/translate/scale `none`,
and transition properties `background-color, border-color, color, box-shadow,
translate, scale` with durations `0.16s` (scale `0.1s`). Hover/fine-pointer media is
true; reduced motion is false. These are runtime observations, not merely source matches.
Treatment snapshots verify the selected radius `0px`, collapse `separate`, or
transition `none`/`0s`; other inspected target styles remain as expected.

### Probe table and evidence paths

Directory names below are under `artifacts/diagnostics/`. Each contains
`manifest.json`, `environment/environment.json`, `build.json`, `applied.json`,
`css-control.json`, `css-before-journey.json`, `journey-phases.json`, `events.json`,
`chrome-trace.json`, derived `css-analysis.json`, logs, `status.json`, and `cleanup.json`.
All Chrome exports are complete. All journeys are **incomplete** at detail click.
Failure screenshots timed out within their 3-second limit; no screenshots were
invented. The open main-thread spans remain unfinished even though trace export ended cleanly.

| Run | Directory                                                       | Exact CSS override                                        | Outcome       |
| --- | --------------------------------------------------------------- | --------------------------------------------------------- | ------------- |
| C0  | `2026-09-13T03-00-22.920Z-ebe3884f-b44b-498f-a478-ddef7edbffe6` | None                                                      | Click timeout |
| P1  | `2026-09-13T03-05-06.721Z-4da5d21e-dfc6-4c45-a342-1f804dd4aadb` | `.market-table-scroll { border-radius: 0 !important; }`   | Click timeout |
| P2  | `2026-09-13T03-09-23.554Z-59ec8741-c24f-47cd-9b62-ad927a56dceb` | `.market-table { border-collapse: separate !important; }` | Click timeout |
| P3  | `2026-09-13T03-13-33.135Z-50d8256b-f9c0-4c71-bc22-7ae44bfed70f` | `.market-table button { transition: none !important; }`   | Click timeout |

| Run | Dataset bodies | Table after bodies | Longest completed Layerize | Open post-scroll Layerize lower bound |     Detail click |
| --- | -------------: | -----------------: | -------------------------: | ------------------------------------: | ---------------: |
| C0  |       51.043 s |           91.194 s |                   87.041 s |                             ≥62.671 s | 60.005 s, failed |
| P1  |       50.992 s |           91.834 s |                   87.739 s |                             ≥62.660 s | 60.003 s, failed |
| P2  |       50.966 s |           92.835 s |                   88.820 s |                             ≥62.684 s | 60.002 s, failed |
| P3  |       50.987 s |           89.355 s |                   85.420 s |                             ≥62.689 s | 60.005 s, failed |

Navigation is separately recorded (about 1.23–1.26 s) and overlaps dataset readiness.
Table/assertion reporting can exceed its declared 90-second timeout when renderer
work returns late; no deadline was changed. These are individual traced observations,
not medians or evidence of speedup from small differences.

The Layerize lower bounds are inferred from unmatched begin events through trace
stop, not completed durations. All four traces include scroll User Timing marks
followed by the unmatched Layerize; no pointerdown/click delivery was observed by
the document capture binding or corresponding marks. No conclusion about event
absence is drawn from the earlier truncated trace. Drawer/chart visibility, close
and restored focus were never reached, so their success and handler completion
remain unverified. No runtime page errors, failed requests or HTTP failures were
observed. Screenshots failing are diagnostic failures, not application HTTP failures.

Largest **individual completed renderer-main-thread spans** (not sums) were:

| Run |  Layout |   Paint | FunctionCall | MajorGC | MinorGC |
| --- | ------: | ------: | -----------: | ------: | ------: |
| C0  | 0.922 s | 0.512 s |      1.216 s | 0.038 s | 0.011 s |
| P1  | 0.861 s | 0.491 s |      1.138 s | 0.049 s | 0.013 s |
| P2  | 0.817 s | 0.523 s |      1.095 s | 0.036 s | 0.007 s |
| P3  | 0.849 s | 0.459 s |      1.123 s | 0.040 s | 0.006 s |

These named spans can nest and exclude unfinished work. They must not be added
into total CPU time or treated as profiling everything inside the stalled span.

### DOM, geometry, and interpretation

All four snapshots retain 5,000 record rows, 5,000 expansion rows, 10,000 tbody rows
and 10,004 table buttons. View details retains its text, enabled state, and 113×44px
bounding size. The observer does not call focus, scroll, hover or click; the shared
journey performs the original locator click and automatic scroll/actionability checks.

C0, P1 and P3 table geometry is identical: 1024×440117px; the first detail target
starts at x=897.296875, y=1072.5. P2 retains width 1024px but height becomes 450121px,
with target x=898.984375, y=1076.5 due to separate borders and existing 2px spacing.
That geometry change is a limitation of P2, not a reduced record workload. No
successful delivery occurred, so equality of actual post-scroll hit testing cannot
be claimed. No treatment proved an interaction improvement. Each override adds one
style node; the application row/expansion/button structure stays intact.

P1 does not support container radius alone as the trigger. P2 does not support
collapsed borders alone as the trigger. P3 does not support transitions alone as
the trigger. They do **not** prove those properties irrelevant in combinations.
Table-container shadow, actual translate/scale states under interaction, descendant
clipping, and other paint/compositing causes remain untested candidates. The named
`table-container-shadow-off` and `table-button-motion-off` controls are available
but were not executed; no conclusion is assigned to them.

### Reproduction and next decision

Executed commands (the final four are the complete experimental series):

```sh
npm run benchmark:diagnostic -- --trace=chrome --css-control=none --dry-run
npm run benchmark:diagnostic -- --trace=chrome --css-control=none
npm run benchmark:diagnostic -- --trace=chrome --css-control=table-container-radius-off
npm run benchmark:diagnostic -- --trace=chrome --css-control=table-border-separate
npm run benchmark:diagnostic -- --trace=chrome --css-control=table-button-transition-off
```

Dry-run evidence is
`artifacts/diagnostics/2026-09-13T03-00-14.876Z-901b9b7d-8f13-4932-96d5-2f21873b2e88/`.
Every rerun creates a new directory. Keep tracing mode/instrumentation fixed when
making a control comparison; do not import these files into Case Study/public evidence.

There is **no supported production patch yet**. The smallest next experiment, in
a separately scoped follow-up, is the untested container-shadow-only control, with
computed-style confirmation and the same fresh control instrumentation. If that
fails, investigate compositor layer reasons/descendant paint chunks before disabling
larger groups. A successful group control would still need a narrower control or
reversal before identifying a specific rule. This task stopped before those probes.

If a rule is later isolated, propose a change only in `src/styles/market.css` shared
by baseline and optimized, with no virtualization, record reduction, algorithm,
profile/deadline, or interaction change. Preserve baseline's full DOM cost and apply
the same presentation correction to both approaches; otherwise the comparison's
fairness changes. P2's border geometry is an example of why passing timing alone
would not justify a patch. Never copy a diagnostic override into production without
reviewing visual and interaction effects.

After a supported patch: required lint/types/unit/build checks, matched control and
confirmation traces, visual/keyboard/focus and pointer regression checks for both
approaches, unchanged row/content workload, and successful drawer/chart/close/focus
at the original deadline. Then validate on the intended controlled Docker runner
with reproducible source/build/browser/profile. Only after an untraced smoke journey
passes should a separately authorized collection obtain five valid samples per
approach; preserve historical failures and do not mix profiles or traced samples.

### Follow-up validation

Tooling changes are limited to `diagnostic-css.ts` and tests, diagnostic CLI/worker,
README and this report. Four new small fixture/mock tests cover default/invalid/
duplicate control selection, registering before navigation, exact metadata,
no-override behavior and observer cleanup. Existing orchestration/timeout/partial
and shared journey tests remain: 10 targeted tests passed. Final lint, typecheck,
and full suite passed (38 files, 364 tests). All four diagnostic preflights and
production builds passed. Browser/server cleanup completed for every probe; only
task-owned process groups were swept. No dependencies or lockfiles changed.

## Container-shadow comparison

### Result

**The hypothesis “removing only the table-container shadow is sufficient to resolve
this timeout” is not supported.** The fresh control reproduced the pre-click stall,
and shadow-off retained both long initial Layerize and the post-scroll timeout.
This does not establish that shadow has zero cost or is irrelevant in combinations.
A single diagnostic pair cannot establish general causality, medians or speedup.
Results apply to local macOS ARM64 only; Docker/CI remains unverified.

Exactly two diagnostics ran sequentially, without retries, extra probes, workload
changes or deadline changes. Both preflights and production builds passed. Both
journeys remain **incomplete**, not valid measurements, despite complete Chrome
trace exports. No tooling defect blocked this test, so no diagnostic code, tests,
production CSS, algorithm or profile was changed. Existing unrelated tracked and
untracked work, including OptimizedExplorer/Overview changes, was preserved.

### Commands and evidence

```sh
npm run benchmark:diagnostic -- --trace=chrome --css-control=none
npm run benchmark:diagnostic -- --trace=chrome --css-control=table-container-shadow-off
```

Paths below are relative to `artifacts/diagnostics/`:

| Run | Directory | Build ID | Journey |
| --- | --- | --- | --- |
| Fresh control | `2026-09-13T05-01-51.123Z-37eb8d13-b837-4170-90d9-ccd6885db046` | `V-j6q4EHYeRBCE2sdiqyl` | Detail click timeout |
| Shadow-off | `2026-09-13T05-06-04.716Z-35068c3d-d805-4495-9074-857eb841d307` | `GsnZBOgOGWJAW-3ocdrSw` | Detail click timeout |

Each directory retains manifest/environment/source fingerprints, `build.json`,
`applied.json`, `css-control.json`, `css-before-journey.json`, `journey-phases.json`,
`events.json`, `chrome-trace.json`, derived `css-analysis.json`, command/server logs,
`status.json` and `cleanup.json`. Failure screenshots could not finish within the
existing 3-second limit. Browser/server cleanup completed in both; no unrelated
server was reused or stopped. Previous artifacts were not overwritten.

The runner does not offer shared-build reuse. It produced separate production
builds from matching source: revision `4aaeec1832203fad0cf82b37f4258d6473aec2f1`,
tracked patch hash, untracked-file fingerprints and lockfile hash all match across
the pair. Instrumentation hashes, profile/deadlines and full browser identity/hash
also match. No binary-identical build claim is made. Same local environment as
before: Node 24.19.0, Chrome for Testing 153.0.8010.12, baseline/large-list,
5,000 records, seed 20260911, viewport 390×844, CPU ×4, profile network, fresh
context/cache disabled, service workers blocked, Chrome tracing throughout.

### CSS and workload verification

The exact treatment is:

```css
.market-table-scroll { box-shadow: none !important; }
```

Source inspection confirms this selector identifies the table scrolling container;
it does not target summary cards or descendant buttons, and box-shadow is not
inherited. The default control inserts no stylesheet. Shadow-off installs one
style element while the document is loading, before the dashboard exists, at
192.6 ms after the document time origin. First-table computed styles and the
pre-journey snapshot both confirm container shadow `none`, versus
`rgba(0, 0, 0, 0.04) 0px 8px 30px 0px` in control. Container radius stays `14px`,
overflow-x/y `auto`, table border-collapse `collapse`, button transition unchanged.

Both retain 5,000 record rows, 5,000 expansion rows, 10,000 tbody rows and 10,004
buttons. Table bounds match exactly: x=17, y=934, width=1024, height=440117px.
The selected View details button is enabled and remains x=897.296875, y=1072.5,
113×44px. Thus the observed workload and target geometry were not reduced.
Successful post-scroll hit testing is not established because neither click was
delivered. The treatment adds one diagnostic style node, not fewer application rows.

### Timing and trace interpretation

| Observation | Fresh control | Shadow-off |
| --- | ---: | ---: |
| Navigation | 1.269 s | 1.234 s |
| Dataset bodies ready | 51.062 s | 50.979 s |
| Table readiness after bodies | 91.145 s | 90.646 s |
| Longest completed Layerize | 87.026 s | 86.585 s |
| CPU duration of that Layerize | 86.966 s | 86.581 s |
| Open post-scroll Layerize lower bound | ≥62.682 s | ≥62.688 s |
| Detail click | 60.001 s, timeout | 60.002 s, timeout |
| Largest completed Layout span | 0.892 s | 0.889 s |
| Largest completed Paint span | 0.481 s | 0.484 s |
| Largest completed FunctionCall span | 1.170 s | 1.161 s |
| Largest completed MajorGC span | 0.044 s | 0.039 s |

Navigation and dataset phases overlap and must not be added. Named trace categories
can nest and must not be summed across categories/threads. The small differences
above are not a speedup claim. Configured dataset/table/action deadlines remain
90/90/60 seconds; a reported duration slightly exceeding its deadline is not a
policy change or acceptance of a failed measurement.

Directly recorded completed Layerize events have duration and thread-CPU duration.
Their close correspondence supports native renderer work rather than merely waiting
for network or being descheduled. The next Layerize has an unmatched begin event
after scroll; its duration through trace stop is an **inferred lower bound**,
not a completed span. Raw trace timestamps (microseconds) make the association
reviewable:

| Event | Control timestamp | Shadow-off timestamp |
| --- | ---: | ---: |
| Completed long Layerize start | 101980134337 | 102232456361 |
| Dashboard scroll mark | 102068174825 | 102320010574 |
| Document scroll mark | 102068175645 | 102320011571 |
| Unfinished Layerize start | 102068337003 | 102320173582 |

Neither the capture binding nor User Timing marks observed pointerdown/click.
Drawer/chart/close/focus phases were not reached; there is no React-handler-completion
claim. Both trace exports are complete, but the main-thread spans remain unfinished.
No event-absence inference relies on an earlier truncated trace. Neither run logged
page errors, request failures or HTTP failures; screenshot timeout is separate.

The same tracing, CSS observer, DOM inspection and event bindings run in both.
They can influence scheduling and absolute duration, so this is evidence under
instrumentation, not proof of uninstrumented behavior or Docker performance.

### Smallest next action and validation

Inspect layer ownership/compositing reasons and descendant paint chunks in a
separately scoped diagnostic. The current traces have `SetLayerTreeId`, but no
explicit compositing-reason or paint-chunk attribution. Their largest Paint event
is attributed to `#document`, nodeId 3 / layerId 0, which does not identify the DOM
owner responsible for the expensive Layerize. Capture a bounded layer-tree snapshot
and layer-to-DOM/compositing-reason mapping near initial table render and automatic
scroll, then correlate with the existing long spans. Do not change more CSS at
random or treat the document-level paint attribution as proof against a descendant.
No such extra capture or probe was run in this task.

No production patch is supported yet. Once a specific mechanism is isolated,
validate a minimal shared correction for baseline and optimized with unchanged
workload, native clicks, visual/accessibility behavior and original deadlines.
Require repeated diagnostic confirmation/reversal and an untraced successful
journey on the intended runner before separately authorized five-sample collection.
Never relabel these timeouts as valid measurements or import them into Case Study.

Only this report and new diagnostic artifacts were written in this task. Both
preflight/build gates passed; journey timeouts are explicitly retained. Documentation
review, `git diff --check` and `git status --short` completed. Application lint/types/
unit tests were not rerun because no application, test or tooling code changed.

## Layer attribution attempt

### Finding and confidence

**Layerize is still confirmed on the renderer main thread; attribution to a specific
DOM structure remains inconclusive.** Existing traces already contained 5,000
`PaintImage` events labeled `IMG class='market-image'`, not just document-level Paint.
That was examined before running another browser. It establishes image paint
participation, but does not connect those nodes to internal Layerize costs.

Exactly one new diagnostic ran, with no CSS override, retries or further probes:

```sh
npm run benchmark:diagnostic -- --trace=chrome --css-control=none --attribution=layers
```

Evidence directory:
`artifacts/diagnostics/2026-09-13T05-20-04.938Z-0abe9afe-6ab9-4550-a87e-7481f7957b73/`.
Key files: raw `layer-attribution.json`, complete `chrome-trace.json`,
`paint-attribution-analysis.json` (includes representative raw PaintImage events),
`css-analysis.json`, phase/event/status JSON, CSS/workload snapshots, environment,
source fingerprints, build and cleanup logs. Raw evidence preceded derived analysis.
Journey status remains **incomplete**, never a valid collection measurement.

### Protocol capability and limits

The official [LayerTree domain](https://chromedevtools.github.io/devtools-protocol/tot/LayerTree/)
is experimental; layer backend-node IDs and tree data can be absent. It exposes
compositing reasons and layer-painted notifications. [DOM.describeNode](https://chromedevtools.github.io/devtools-protocol/tot/DOM/#method-describeNode)
can describe a backend node at bounded depth. These API descriptions are not a
promise that this browser/session will deliver data or expose internal paint chunks.

In actual Chrome for Testing **153.0.8010.12**, `LayerTree.enable` returned success.
No `layerTreeDidChange` or `layerPainted` event arrived in the separate attribution
session during the diagnostic. Consequently there were no layer IDs to pass to
compositingReasons and no backend IDs to describe. Those methods were **not exercised
against the real browser**; their runtime support remains unverified. The absence
of events is not proof of an unsupported API, absence of layers, or an unrelated DOM node.
No mapping to table container, table, row, button or another element was obtained.

| Snapshot label              | Node-side timestamp (UTC) | Result / timing interpretation                               |
| --------------------------- | ------------------------- | ------------------------------------------------------------ |
| after-navigation            | 05:20:13.742              | No tree delivered; before dataset/render completion          |
| after-table-before-click    | 05:22:34.676              | No tree delivered; table readiness had completed             |
| after-first-observed-scroll | 05:22:35.154              | No tree delivered; triggered once by existing scroll binding |

These are receipt/inspection timestamps, not browser compositor snapshot times.
Had a tree been available, its own receipt timestamp would identify potential
staleness. No repeated query or dense polling was used while the renderer was busy.

The opt-in collector is diagnostic-only and default-off. Limits: 40 CDP commands
including disable, 3 phase snapshots, 32 retained largest-area layers per snapshot,
6 queried layers per snapshot, 1-second per-request limit, 64 KiB per retained record,
1 MiB total attribution budget with metadata reserve. Layer-painted notifications
retain at most 12 per phase. Missing/truncated data is explicit. Raw sampled tree
records are persisted before querying reasons/node descriptions; the sample is
not a complete layer tree. No full DOM walk, screenshot dependency, paint replay or
unbounded command-log request was introduced. The existing Chrome trace is a
separate artifact with its prior tracing configuration and total runner deadline.

This run made only **two** attribution commands (enable and disable), retaining
about 1.5 KiB of entry payload with no dropped entries. Disable timed out after
1 second; detach also timed out after 1 second. Listeners were removed before
cleanup requests; the owned browser was then closed, terminating its sessions.
The runner kept both cleanup limitations and closed its server. No extra wait or
retry was used. A successful enable response alone must not be reported as successful
layer attribution.

### Recorded timeline and paint attribution

Source revision: `4aaeec1832203fad0cf82b37f4258d6473aec2f1`, with pre-existing staged
work preserved and current diagnostic edits fingerprinted. Build ID:
`f6tRScKHZJFzQljFtG9bA`. Preflight/build passed on local macOS ARM64 with pinned
browser and profile. Baseline/large-list, 5,000 records, seed 20260911, viewport,
CPU/network/cache/service-worker settings, pointer journey and all original
assertion/time limits are unchanged. Attribution is new instrumentation, so these
timings are not a matched performance comparison against the earlier control.

| Observation                              | Result                                |
| ---------------------------------------- | ------------------------------------- |
| Navigation (including optional snapshot) | 1.260 s                               |
| Dataset bodies                           | 51.026 s                              |
| Table after dataset                      | 91.122 s                              |
| Detail click                             | 60.002 s, timeout                     |
| Completed long Layerize                  | 87.025 s wall / 86.970 s thread CPU   |
| Open post-scroll Layerize                | ≥64.681 s inferred through trace stop |
| Renderer process / main thread           | PID 27379 / TID 1701818               |
| Completed Layerize start                 | 103073483616 µs                       |
| Open Layerize start                      | 103161680605 µs                       |

The open-span lower bound includes the extra bounded attribution cleanup before
trace stop; its larger value is not evidence of a larger application regression.
Completed and unfinished spans are distinguished. Navigation/dataset phases overlap;
nested/cross-thread trace categories are not summed. The trace export is complete,
although the renderer's final Layerize span did not finish. No pointerdown/click
was observed; drawer/chart/close/focus were not reached. Capture event delivery would
not imply React handler completion even if observed. No app page errors, request
failures or HTTP failures were recorded. Failure screenshot hit its existing 3-second
limit. Baseline retains 5,000 record rows/5,000 expansion rows in workload evidence.

The trace records **5,000 PaintImage events and 5,000 distinct trace node IDs**, all
labeled `IMG class='market-image'`, using five data-SVG URLs. Coordinates span
local paint y=129.5 to 440041.5; image dimensions are 64×64px. All those events finish
before the long initial Layerize starts. Largest individual PaintImage is 2.757 ms.
These local paint coordinates are not viewport visibility or layer bounds. Trace
node IDs were not assumed to be usable CDP backend IDs without validation.

This associates paint work with images across the full table, **not** the 87-second
Layerize with one image, layer, or rule. Document-level Paint, image paint events,
and composited-layer ownership describe different things. The trace still lacks
internal paint-chunk/merge attribution or native call stacks inside the long
Layerize. Layer count/reasons alone would not establish that cause either. The
new session/observers may affect scheduling, and lack of LayerTree delivery may
reflect session/browser/lifecycle behavior; one run cannot distinguish those.
Docker/CI remains unverified.

### Exactly one proposed controlled experiment (not executed)

Compare the same no-override baseline against a diagnostic-only, pre-render
`visibility: hidden` override restricted to `.market-table .market-image`, keeping
all image elements/src values, row/expansion DOM, layout dimensions, records,
profile and native pointer journey unchanged. This tests whether painting the
5,000 row images contributes materially to the layerization stall. It deliberately
changes visible image rendering, so it is a mechanism test, not a production patch
or fair benchmark result. Do not use `display:none`, remove rows, change data or
alter application code.

**Support criterion:** verify the expected loss of row-image PaintImage events,
unchanged DOM/geometry, and a substantial removal of both long initial and
post-scroll Layerize stalls with delivered click and completed journey. This would
make row-image painting a candidate contributor, not identify an individual image
or prove a specific browser defect. **Rejection criterion:** if image paint is
suppressed but Layerize and timeout persist, the hypothesis that suppressing row-image
paint alone is sufficient is unsupported. If geometry/workload changes or the
control does not reproduce, the comparison is inconclusive.

For feasible additional attribution within that future experiment, retain matching
trace instrumentation in both arms and add bounded native renderer stack sampling
around Layerize if the environment permits it; native stacks or browser paint-chunk
instrumentation are needed to explain work that LayerTree does not expose. Do not
infer ownership from missing mapping. This is one proposed two-condition experiment,
not authorization to run it now; no further probes were executed in this task.

### Files and validation

Added `diagnostic-layers.ts` and its five focused tests; updated diagnostic CLI/worker
and README to expose opt-in attribution and persist its limits/fingerprint. No
production feature, stylesheet, collector policy, dependency or lockfile changed.
Tests cover missing trees/backend IDs, CDP failure, request/snapshot/output caps,
listener/session cleanup and hung operations with fake timers. Five targeted tests
passed; final lint, typecheck and full suite passed (39 files, 381 tests). The
initial TypeScript listener-adapter mismatch was corrected before the browser run.
Preflight and production build passed; the single journey intentionally remains
failed/incomplete. No benchmark/memory collection, import/publish, deployment,
median or speedup was generated. Final diff/status and new-file review completed.


## Row-image paint comparison

Executed the preceding proposed experiment after user authorization: one fresh
control followed by one treatment, with no retries or additional probes. This is
a diagnostic mechanism test; hiding useful images is not a production fix.

### Reproduction and evidence

```sh
npm run benchmark:diagnostic -- --trace=chrome --css-control=none --attribution=none
npm run benchmark:diagnostic -- --trace=chrome --css-control=table-image-paint-off --attribution=none
```

Evidence directories (relative to repository root):

- Control: `artifacts/diagnostics/2026-09-13T05-31-41.151Z-79e40a2f-2524-475b-812a-2b9c0303d007`
- Treatment: `artifacts/diagnostics/2026-09-13T05-35-33.925Z-74be8d98-58b0-4f57-871b-f43764e7c39e`

Each directory retains runner metadata, preflight/build logs, phases, CSS snapshots,
browser events and complete `chrome-trace.json`. Derived `css-analysis.json` and
`image-paint-analysis.json` summarize the raw evidence; timeout remains a failure.
Source HEAD is `4aaeec1832203fad0cf82b37f4258d6473aec2f1`; tracked/untracked source
fingerprints match between arms. The runner builds per invocation: build IDs are
`337mh-2Etaj4UyNJ168Vr` (control) and `izEJzdH6NJ1cNvg-5zbW6` (treatment), so these
are separate production builds of the same source, not a reused binary build.
Both preflight and builds passed before their respective browser journey.

Both arms use baseline/large-list, 5,000 records, seed 20260911, Chrome for Testing
153.0.8010.12 revision 1243, local macOS ARM64, viewport 390×844, CPU throttle 4,
network latency 150 ms/download 200000/upload 75000 bytes per second, fresh context,
disabled cache and blocked service workers. Journey/assertions/deadlines are unchanged:
60-second action limit and diagnostic 600-second total/540-second work budget.
No force click, removed action, reduced dataset or virtualized baseline was used.

Both arms have the same new image-source/count and three-image geometry inspection.
LayerTree attribution is disabled in both; no native stack sampling was added.
This pair therefore differs in instrumentation from the preceding layer-attribution
run. Tracing and inspection can influence scheduling; these are diagnostic timings,
not benchmark measurements or a comparison against that earlier run.

### Override and workload validation

Treatment installs only `.market-table .market-image { visibility: hidden !important; }`.
Both install events report `beforeApplication: true`, document `loading`, at
217.2 ms (control) and 186.2 ms (treatment) after time origin. First-table computed
styles and the pre-journey snapshot confirm visible versus hidden image visibility.
No application CSS or logic changed.

Both snapshots contain 5,000 record rows, 5,000 expansion rows, 10,000 tbody rows,
10,004 table buttons and 5,000 images. Exact source-frequency maps match for five
SVG data URLs (counts 1011, 991, 1013, 1009, 976). Table geometry is 1024×440117 px;
container geometry is 358×440119 px. Images sampled at indices 0, 2500 and 4999
retain 64×64 px rectangles and identical positions (y=1062.5, 221062.5, 440974.5).
The detail button retains 113×44 px geometry, text and enabled state. This verifies
retained DOM/source workload and sampled layout, not every image's computed style.
The intervention intentionally changes painting while retaining those inputs.

### Observations

| Observation | Fresh control | Image paint off |
| --- | --- | --- |
| Navigation | 1.271 s | 1.228 s |
| Dataset readiness | 51.037 s | 50.968 s |
| Table readiness after dataset | 91.140 s | 56.363 s |
| Completed initial long Layerize | 87.132 s | 52.570 s |
| Post-scroll Layerize | unfinished, ≥62.671 s | completed, 52.957 s |
| Later Layerize after click/focus | not reached | unfinished, ≥8.165 s |
| PaintImage before delivered click (all events if no click) | 5,000 | 0 |
| PaintImage after click | no click | 1 |
| Pointerdown/click reaches detail button | no | yes, trusted events |
| Focus reaches drawer Close | not observed | yes |
| Detail click action | timeout, 60.002 s | timeout, 60.002 s |
| Drawer/chart/close assertions; full journey | not reached; incomplete | not reached; incomplete |

Initial long Layerize begins at trace timestamps 103769834092 µs (control) and
104001351373 µs (treatment). Post-scroll spans begin at 103858149318 µs and
104055024265 µs respectively. Treatment's later open span begins at 104109542789 µs.
Open-span values are lower bounds through trace stop, not completed durations;
the later treatment span is a different stage from the control's post-scroll span.
Do not compare its 8-second bound with the control's 62-second bound as an improvement.
Readiness and trace phases overlap and must not be summed.

Treatment emits trusted pointerdown at 05:38:21.879Z and click at 05:38:21.931Z,
both targeting `market-detail-market-000001`, with a 113×44 px hit rectangle at
x=229.297, y=399.5. Focus reaches `market-close` at 05:38:22.923Z, consistent with
drawer activation. The click promise still times out at 05:38:28.401Z before the
runner can execute drawer visibility/chart assertions. Event delivery and Close
focus do not establish completed handlers, a visually validated drawer or journey
success. The single later PaintImage is consistent with drawer rendering; row-image
paint is absent before click, not absent throughout the entire treatment trace.

Neither arm records page errors, failed requests or HTTP failures. Failure screenshot
capture reaches its existing 3-second limit; analysis relies on persisted events and
trace, not that screenshot. Cleanup completes and traces export in both arms.

### Interpretation and next action

The control reproduces the stall. Suppressing row-image paint while retaining
source/DOM/geometry coincides with a materially shorter initial Layerize and a
completed post-scroll Layerize, allowing click delivery. This supports row-image
painting as a **candidate partial contributor**, not the full internal attribution
of Layerize. Both initial and post-scroll work remain long, and another span stalls
after click. The prior full-resolution support criterion is not met: suppressing
row-image paint alone is still insufficient to complete the journey.

One pair does not establish causality, a median, a speedup, individual image blame,
or a Chrome defect. LayerTree mapping/native stacks remain missing; macOS results
remain unverified on Docker/CI. No production performance change is justified yet.

The smallest next experiment is a repeated reversal with the same instrumentation
and profile: restore visible row images between paint-off observations. Confirm the
candidate only if restoring painting restores the long initial/post-scroll stall and
removes click delivery consistently, with matched source/DOM/geometry; otherwise
weaken the partial-contributor hypothesis and investigate scheduling variability.
This follow-up has not been run. Native renderer stack attribution is still needed
to explain the remaining internal work, rather than guessing another CSS property.

### Changed files and validation

Updated diagnostic CSS controls/snapshots and the colocated test, README and this
report. The new test verifies selector scope, retained DOM/src/display and unaffected
outside images/buttons; real-browser snapshots validate retained geometry. Targeted
CSS tests passed (5 tests). Final `npm run lint`, `npm run typecheck`, `npm test`
(39 files, 382 tests) and `npm run build` passed. Both diagnostic invocations passed
preflight/build and failed the journey as recorded. No extra browser run, official
benchmark/memory collection, import/publish, deployment or UI result was generated.


## Reversal preflight blocker

After authorization to continue, planned a bounded two-condition follow-up:
repeat `table-image-paint-off`, then restore painting with `none`, using the same
existing instrumentation/profile/deadlines. The first invocation failed preflight;
no application diagnostic ran and the second invocation was not started. No retry
or alternate browser/profile was attempted.

Command actually executed:

```sh
npm run benchmark:diagnostic -- --trace=chrome --css-control=table-image-paint-off --attribution=none
```

Evidence: `artifacts/diagnostics/2026-09-13T06-32-52.290Z-cc6df634-eecb-44f7-a3ae-ba3915da23d3`.
Retained files are `manifest.json`, `preflight.txt`, `phases.json`, `status.json`,
`cleanup.json`, and `environment/{environment.json,source.patch,untracked-files.json}`.
Source HEAD remains `4aaeec1832203fad0cf82b37f4258d6473aec2f1`, Node is 24.19.0;
manifest patch SHA-256 is
`102b906c14c495227b1b79ed1c415db2aa8bafcf97fc9fe5a222c9dd183b6c21`.
Existing staged/unstaged/untracked changes were preserved.

| Stage | Observed result |
| --- | --- |
| Preflight | failed; phase duration 1.340 s |
| Browser launch | Chrome process PID 30048 exits with SIGABRT |
| Browser identity/profile acknowledgement | unavailable; preflight rejects missing observations |
| Production build | not reached |
| Application journey / CSS override installation | not reached |
| Chrome trace / Layerize / paint / input events | no application evidence collected |
| Restored-paint control | not started |
| Cleanup | recorded complete at 2026-09-13T06:32:53.679Z |

Playwright reports `browserType.launch: Target page, context or browser has been
closed`. Its launch log records `kill EPERM` during cleanup and then process exit
with `SIGABRT`, followed by temporary-directory cleanup. This occurred in the
restricted execution environment and is compatible with a permission/environment
problem, but the log alone does not establish why Chrome aborted. Missing viewport,
CPU/network/cache and identity checks are consequences of unavailable browser
observations, not evidence that the requested profile actually changed.

This is an environment/preflight failure, not another journey timeout or an image
paint result. There is no reversal comparison and no new support or rejection of
the prior partial-contributor hypothesis. No production, tooling, profile or timeout
was changed, and no performance measurement was created. Docker/CI remains unverified.

The next prerequisite is to diagnose Chrome startup permissions/crash evidence in
the intended execution environment, then pass preflight before resuming the same
bounded reversal experiment. Do not infer a CSS cause from this launch failure or
silently retry collection with different browser flags.

Only this report changed during this follow-up. The diagnostic command exited 1;
build and application tests were not run because collection stopped at preflight
and there are no code changes. Reviewed the new failure artifacts and document;
`git diff --check` passed and `git status --short` was reviewed.


## Chrome startup check

Investigated the preceding startup failure after user authorization. The macOS
crash report `~/Library/Logs/DiagnosticReports/Google Chrome for Testing-2026-09-13-133257.ips`
matches PID 30048 and capture time 2026-09-13 13:32:53.7183 +0700. It records
`EXC_CRASH` / `SIGABRT`, `abort() called`, on thread 0 / `com.apple.main-thread`.
The stack contains `___RegisterApplication_block_invoke`, `_RegisterApplication`,
`TransformProcessType`, then Chrome entry frames. This identifies a browser-process
startup abort during macOS application registration, before application navigation;
it is separate from the renderer Layerize bottleneck. The cleanup `kill EPERM`
message alone was not used to infer the original abort cause.

Ran the unchanged environment-only preflight once **outside the tool sandbox**
using approved elevated execution, with the same full Chrome executable and flags:

```sh
BENCHMARK_ENV_OUTPUT=artifacts/diagnostics/startup-preflight-2026-09-13-30048 node node_modules/@playwright/test/cli.js test --config scripts/benchmark/playwright.config.ts
```

The command passes: 1 test, 2.4 seconds, exit 0, environment status `passed`, no
failures. Observed Chrome for Testing is 153.0.8010.12/revision 1243, executable
SHA-256 `8319963f6625accf51c0dd4f55091ceaf9f09ed39e7a52fed4fae12b2a6b668a`.
Node 24.19.0 and Playwright 1.63.0 match the profile. Viewport 390×844/DPR 1,
locale en-US/timezone UTC, CPU rate 4, network latency 150 ms/download 200000/upload
75000 bytes per second, fresh context, disabled/cleared cache and blocked service
workers pass the existing checks. Dataset generation confirms seed 20260911 and
5,000 records. CDP acknowledgements do not independently calibrate physical
throttling. The artifact's five-iteration plan is metadata; no iterations ran.

Evidence directory: `artifacts/diagnostics/startup-preflight-2026-09-13-30048`.
It retains `environment.json`, `source.patch`, `untracked-files.json`,
`crash-excerpt.json` (selected original crash fields/frames), and
`startup-check.json` (execution context, command and observed result).

The failed restricted launch followed by a successful unrestricted preflight
supports an execution-environment/sandbox-related startup issue. It does not isolate
the precise denied macOS service/permission or prove every restricted launch fails;
there was no second restricted launch. No browser reinstall, permission mutation,
flag change, dependency change or runner workaround was needed.

The startup prerequisite now passes in the tested execution context. The next
application step remains the bounded paint-off/restored-paint reversal, running
both conditions in that same context with their existing preflight/build gates.
It has not been resumed in this startup-only task. There is still no new evidence
about image causality, remaining Layerize work, journey completion or Docker/CI.

Only this report was edited; all existing changes were preserved. Reviewed the
crash excerpt and successful environment artifact. Preflight passed; production
build, lint/typecheck/unit tests and application diagnostics were not run in this
documentation/startup-only follow-up. `git diff --check` passed and
`git status --short` was reviewed.


## Row-image reversal

After authorization, ran exactly two sequential diagnostics outside the tool
sandbox, the context verified by the startup check: repeat paint-off, then restore
painting with `none`. No retries, extra probes or production/tooling changes.

```sh
npm run benchmark:diagnostic -- --trace=chrome --css-control=table-image-paint-off --attribution=none
npm run benchmark:diagnostic -- --trace=chrome --css-control=none --attribution=none
```

Evidence directories relative to the repository root:

- Repeated paint-off: `artifacts/diagnostics/2026-09-13T06-36-32.562Z-e818af53-2985-46be-a2ee-5c65e0937b44`
- Restored painting: `artifacts/diagnostics/2026-09-13T06-39-55.822Z-ee8cc452-a897-4974-8853-818b4064a514`

Both retain manifest/environment/build metadata, raw CSS snapshots, journey phases,
browser events, complete Chrome traces and cleanup records. `css-analysis.json`
and `reversal-analysis.json` derive timing/event observations from the raw evidence.
The restored-paint directory also contains `reversal-matched-inputs.json`, recording
matched-input checks across the two arms. These ignored artifacts are diagnostic
failures, not importable measurements.

### Matched inputs and override

Both preflights and production builds passed. Source HEAD remains
`4aaeec1832203fad0cf82b37f4258d6473aec2f1`; source metadata/patch fingerprint,
untracked-file hashes, instrumentation hashes, scenario options, actual browser
identity, applied profile and deadlines match across this pair. Separate builds
of the same source have IDs `J56aCWJNKLOwUVgC6XkK4` (paint-off) and
`Sjw3ilnX4LyIusm4vDwKl` (restored). The runner does not reuse one build binary.

Baseline/large-list retains 5,000 records and seed 20260911, Chrome for Testing
153.0.8010.12/revision 1243 on local macOS ARM64, viewport 390×844/DPR 1, CPU 4,
network latency 150 ms/download 200000/upload 75000 bytes per second, disabled cache,
fresh context and blocked service workers. Native pointer journey, assertions,
60-second action deadline and 600-second diagnostic budget remain unchanged.
Both arms use Chrome tracing, the existing CSS/workload observer and no LayerTree
session (`--attribution=none`); no extra queries were added during renderer stalls.

Install events precede application DOM with document `loading`, at 204.6 ms and
194.1 ms after time origin respectively. Paint-off applies only
`.market-table .market-image { visibility: hidden !important; }`; restored control
injects no override. Snapshots retain 5,000 records/5,000 expansion rows, 10,000 tbody
rows, 10,004 table buttons and 5,000 image elements. Exact source-frequency maps
match. Three sampled images change hidden to visible while preserving 64×64 px
rectangles and positions. Table/container/button geometry, enabled state and button
text match. The table remains 1024×440117 px. DOM workload is retained; image
painting is intentionally changed.

### Results

| Observation | Repeated paint-off | Restored painting |
| --- | --- | --- |
| Navigation | 1.257 s | 1.236 s |
| Dataset readiness | 51.002 s | 50.980 s |
| Table readiness after dataset | 58.671 s | 88.700 s |
| Completed initial long Layerize | 54.719 s | 84.621 s |
| Post-scroll Layerize | completed, 54.405 s | unfinished, ≥62.677 s |
| Later Layerize after click/focus | unfinished, ≥6.646 s | not reached |
| PaintImage before click, or entire trace if no click | 0 | 5,000 |
| PaintImage after delivered click | 1 | no click |
| Pointerdown/click reaches detail button | yes, trusted | no |
| Focus reaches Close | yes | not observed |
| Click action | timeout, 60.002 s | timeout, 60.003 s |
| Drawer/chart/close assertions and journey | not reached; incomplete | not reached; incomplete |

Long spans run on renderer main threads: paint-off PID 30763/TID 1742662 and
restored PID 31098/TID 1745914. Initial completed spans start at trace timestamps
105821951402 µs and 106025384189 µs. Post-scroll spans start at 105877896153 µs
and 106111197629 µs. Paint-off's later open span starts at 105933928981 µs.
Lower bounds extend through trace stop; they are not completed durations. Its
6.646-second later bound is a different stage from the restored 62.677-second
post-scroll bound, so those values must not be compared as equivalent spans.
Readiness and nested trace phases overlap and are not summed.

Paint-off pointerdown arrives at 06:39:24.481Z, click at 06:39:24.532Z, both targeting
`market-detail-market-000001` with matching hit target and 113×44 px rectangle.
Close receives focus at 06:39:25.570Z. The click promise nevertheless times out
at 06:39:29.576Z. These events support input delivery and drawer activation but
are not a passed drawer visibility/chart assertion or proof of handler completion.
The lone PaintImage after click is consistent with drawer rendering; image paint
is suppressed before click, not throughout the full trace.

Neither arm records page errors, request failures or HTTP failures. Both failure
screenshots hit the existing 3-second limit. Both traces export completely and
cleanup completes (06:39:34.596Z and 06:43:28.179Z); final renderer spans are still
unfinished. Neither run is a valid benchmark result.

### Interpretation and smallest next step

The preceding pair observed initial Layerize 87.132 s with visible images and
52.570 s with paint-off. This reversal repeats the same qualitative pattern:
paint-off again completes post-scroll Layerize and delivers click; restoring image
painting restores a longer initial span and pre-click stall. Together with matching
DOM/source/geometry within the new pair, this strengthens the **partial-contributor**
hypothesis. It does not establish that images explain all Layerize work, a specific
paint-chunk algorithm, or an individual image defect. Minor differences between
same-condition runs are not speedups; no median or causal certainty is claimed.

Suppressing row-image paint is still insufficient: both paint-off attempts retain
more than 50 seconds of initial/post-scroll Layerize and time out after delivery.
Hiding useful images is not a production fix. Machine scheduling/thermal/background
conditions were not randomized or independently controlled, and tracing/inspection
can affect timing. The startup environment change is explicit; no Docker/CI result
can be inferred from this local series.

The next smallest diagnostic is bounded native renderer stack sampling during the
remaining long Layerize in a paint-off run, without another CSS change. Establish
sampler availability/permissions first and stop if unavailable; preserve existing
journey deadlines. Symbolized samples concentrated in specific paint/layer routines
would narrow the remaining mechanism; missing or unsymbolized samples would leave
attribution unresolved. This is proposed only, not executed here. LayerTree absence
must not be substituted for native attribution.

Only this report changed in this follow-up. Both preflight/build gates passed;
both diagnostic commands exited 1 because of click timeout. No lint/typecheck/unit
suite rerun was needed for the documentation-only change. Reviewed the document,
new derived artifacts and raw event/workload evidence; `git diff --check` passed
and `git status --short` was reviewed. Unrelated changes remain preserved.


## Native renderer sampling

After authorization, checked native sampler availability/attach permission, then
ran exactly one paint-off application diagnostic outside the tool sandbox. No
production or repository diagnostic tooling changed, no new CSS intervention and
no repeated journey. Native sampling is additional instrumentation, so this run is
not an equivalent timing comparison with the reversal pair.

### Capability check and collection

`/usr/bin/sample` is installed; its local usage documents duration in seconds and
sampling interval in milliseconds. The first task-owned about:blank browser exposed
three renderer processes instead of one, so the capability script stopped before
sampling and closed its browser. The corrected permission-only check sampled one
owned renderer for 1 second at a 10 ms interval, without claiming page attribution;
it exited 0 and closed the browser. Capability artifacts:

- `artifacts/diagnostics/native-sampler-check-1789284480391/processes.json`
  (initial ambiguous renderer enumeration; no sample).
- `artifacts/diagnostics/native-sampler-check-1789284504404/{processes.json,result.json,sample.txt}`
  (successful permission check).

Application invocation:

```sh
npm run benchmark:diagnostic -- --trace=chrome --css-control=table-image-paint-off --attribution=none
```

A one-off external Python harness observes the runner's phase file every 2 seconds.
Ten seconds after first observing the table phase, it takes one OS process-tree
snapshot and selects only `--type=renderer` descendants of the task-owned runner.
It samples all three owned renderers concurrently, each with:

```sh
/usr/bin/sample <owned-renderer-pid> 5 10 -file <evidence>/native-<pid>.txt
```

Each sampler has a 20-second subprocess deadline; no second sampling window or CDP
polling is used. Renderer count outside 1..3 aborts sampling. The diagnostic's
original work/cleanup budget remains in force; the external harness adds a final
600-second observation cap. Raw reports were written before analysis. All three
samplers exited 0 after approximately 5.7 seconds including symbol processing;
reports are 218987, 213945 and 237150 bytes. There is no hard byte cap in `sample`;
process count, duration and interval bound this capture, whose output sizes are
recorded rather than claimed to be guaranteed limits.

Evidence directory:
`artifacts/diagnostics/2026-09-13T07-29-14.154Z-02ff2d6f-f999-4921-9750-de80ac3e7e25`.
It retains the ordinary manifest/preflight/build/CSS/events/phases/Chrome trace,
`native-harness.py` (exact one-off reproduction harness), `native-processes.json`,
`native-sampling.json`, three `native-<pid>.txt` reports, derived
`native-main-stack-excerpt.txt`, `native-analysis.json` and `css-analysis.json`.
The harness can be inspected and invoked with `python3 <evidence>/native-harness.py`
from this checkout in the same authorized execution context; it creates a new
unique diagnostic directory. It is not part of official collection tooling.

### PID/thread/time attribution

Trace long Layerize spans belong to PID **32698**, renderer main thread **1770743**.
The native report `native-32698.txt` records `Thread_1770743`, main dispatch queue,
with **456 samples**. This establishes process/thread correspondence, not DOM
ownership. The other two owned renderers (32696/32697) show main-thread message
waits during this window and are not used to attribute the costly Layerize.

Sampling invocation runs from 07:30:24.291512Z to 07:30:29.994142Z. Aligning the
CSS-installed UserTiming mark with its `timeOrigin + now` binding gives approximate
trace bounds 107790491545–107796194175 µs, entirely inside the initial completed
Layerize [107782375219, 107836727339] µs. The interval includes symbol processing;
it is not a per-sample trace timestamp series. The multi-second margins establish
window overlap despite the approximate cross-clock alignment. No post-scroll or
after-click native stacks were collected.

The main-thread stack is concentrated under repeated Chrome framework addresses,
including `0x11505840c` (reported as `ChromeMain + 17920260`). These large offsets
are fallback symbol labels, not evidence of actual execution inside a function
named ChromeMain. The report also contains `_sigtramp`, `mach_absolute_time`,
`_platform_memmove` and partially unwound `0x0` frames. Their presence does not
identify a paint algorithm or establish that signal handling caused the stall;
profiling and the unchanged CPU-throttle configuration may affect observed stacks.
Nested sample counts are not summed into CPU duration or percentages.

Framework load address is `0x113f3c000`, UUID
`4C4C448E-5555-3144-A1A2-ED142D8DA577`, Chrome 153.0.8010.12 ARM64. These identifiers
and binary-image ranges remain in the raw report for offline symbolication. A
targeted search of the installed Chromium revision directory found no `.dSYM`,
`.sym` or `.debug` files. This does not prove matching symbols are unavailable
elsewhere. No external symbol download, browser replacement or rebuild was attempted.

### Journey and limitations

Preflight/build passed; build ID is `D7FhY3LS8uhCWNaWqXPHW`, source HEAD remains
`4aaeec1832203fad0cf82b37f4258d6473aec2f1`. Baseline/large-list, seed 20260911,
5,000 records, pinned Chrome/profile/cache policy and existing journey/deadlines
remain unchanged. Snapshots retain 5,000 images, 5,000 rows/5,000 expansion rows,
10,000 tbody rows and 10,004 buttons; sampled images are hidden as intended.

| Observation | Sampled paint-off run |
| --- | --- |
| Dataset readiness | 51.074 s |
| Table readiness after dataset | 58.249 s |
| Initial completed Layerize | 54.352 s |
| Post-scroll completed Layerize | 54.260 s |
| Later open Layerize after click/focus | ≥6.738 s through trace stop |
| Click action | timeout, 60.003 s |
| Pointerdown/click / Close focus | delivered / observed |
| Full drawer/chart/close assertions | not reached |

Initial and post-scroll spans are completed durations; the later value is only a
lower bound. Phases overlap and must not be summed. One PaintImage is recorded
in the full trace. No page errors, failed requests or HTTP failures are recorded;
the screenshot reaches its existing 3-second deadline. Trace export completes,
samplers finish before browser cleanup, and runner cleanup completes at
07:32:16.442Z. The diagnostic exits 1; the external harness exits 0 after reporting
that failure, which must not be mistaken for a passed journey.

Native sampling succeeded at process/thread/time attribution but **not function
or DOM attribution**. It does not resolve the remaining Layerize mechanism, prove
a layer-merge/paint-chunk hypothesis or justify production image hiding. Sampling
can perturb execution; no speedup, median, valid measurement or Docker/CI result
is inferred.

The smallest next step is offline symbolication of these existing addresses using
symbols matching the framework UUID/build/architecture. Verify symbol availability
and exact identity before downloading or using them; if unavailable, report that
blocker instead of assigning names from a different build. Named frames could then
narrow a later controlled experiment. No additional browser run is needed for this
next check.

Only this report changed in the repository. Preflight/build and all three bounded
sampler invocations passed; the single journey failed as recorded. No application
or committed tooling changes required lint/typecheck/unit tests in this follow-up.
Reviewed the document and newly created raw/derived artifacts; `git diff --check`
passed and `git status --short` was reviewed. Unrelated changes remain preserved.


## Offline symbol check

After authorization, investigated symbols for the saved native stack without
starting a browser, rebuilding, changing flags/profile or collecting another sample.

### Identity and local check

`dwarfdump --uuid` confirms the installed framework is ARM64 UUID
`4C4C448E-5555-3144-A1A2-ED142D8DA577`, matching `native-32698.txt` exactly.
`atos` against that binary at recorded load address `0x113f3c000`, for saved PCs
`0x11505840c`, `0x114e73870` and `0x11aa3e6c4`, exits 0 but returns only
`ChromeMain + 17920260`, `ChromeMain + 15934824` and `ChromeMain + 112186300`.
Successful tool exit is not successful function attribution.

The [official Chromium download guide](https://www.chromium.org/getting-involved/download-chromium/)
states that Chrome for Testing/Chromium builds do not have symbols. The
[official macOS symbol downloader source](https://chromium.googlesource.com/chromium/src/+/main/tools/mac/download_symbols.py)
documents the Google Chrome dSYM URL template and six candidate channels. That
archive mechanism targets official Google Chrome, so version equality alone cannot
establish compatibility with this Chrome for Testing binary.

### Bounded remote archive check

HEAD requests in the restricted environment failed DNS resolution; those failures
were retained separately, not interpreted as missing symbols. Repeated the bounded
metadata requests outside the sandbox: five channels return HTTP 404; beta returns
HTTP 200 for `googlechrome-153.0.8010.12-arm64-dsym.tar.bz2`, Content-Length
2,594,650,611 bytes. No archive was executed or fully downloaded.

Read only the first 8,388,608 compressed bytes using HTTP Range. The server returns
206 with `Content-Range: bytes 0-8388607/2594650611`. Bounded decompression produces
19,553,108 prefix bytes (64 MiB cap). The framework DWARF member appears first in
the tar archive, enabling inspection of its Mach-O load commands from its first
64 KiB without extracting the 8,401,090,884-byte member.

| Identity | Sampled binary | Official beta dSYM candidate |
| --- | --- | --- |
| Version | 153.0.8010.12 | 153.0.8010.12 archive |
| Architecture | ARM64 | ARM64 (`CPU_TYPE_ARM64`, 0x100000c) |
| Framework UUID | `4C4C448E-5555-3144-A1A2-ED142D8DA577` | `4C4C44B1-5555-3144-A1C4-BEDB1613A45E` |
| Compatible for saved addresses | target | **no; UUID mismatch** |

UUID comes from the candidate's `LC_UUID` command, not its filename. The partial
tar reader subsequently reports expected end-of-data because only a prefix was
requested; the framework header was already parsed. This does not indicate a
corrupt remote archive. No symbols from the mismatched candidate were applied,
and no remaining archive bytes were downloaded.

### Evidence, conclusion and next step

Evidence directory: `artifacts/diagnostics/symbol-check-2026-09-13`.
Files include `local-symbol-check.json`, `archive-head-checks.json` (sandbox DNS
errors), `archive-head-outside-sandbox.json` (HTTP results),
`archive-prefix.bz2.part`, `archive-prefix-inspection.json`, `conclusion.json`
(including prefix SHA-256), and the exact bounded reproduction scripts
`lab-symbol-head.py` / `lab-symbol-prefix.py`.

The check finds **no usable matching symbols** in the installed binary or the
examined official archive. It does not prove no private/build-owner symbol artifact
exists anywhere. Native function/DOM attribution remains blocked; the saved signal
and clock frames cannot be assigned to a specific throttling or paint algorithm
from the incompatible symbols. The earlier partial-contributor evidence and failed
journeys remain unchanged. No median, speedup or Docker/CI conclusion is added.

The smallest next action is to obtain a framework dSYM matching the exact target
UUID from the build provider, if available, then symbolicate the existing samples.
If unavailable, native named-frame attribution requires a separately planned
reproduction on a symbol-enabled build; that would change the browser and require
fresh controls, not reinterpretation of these addresses. No such build/download/run
or external message was performed here.

Only this report changed in the repository. `dwarfdump` and `atos` ran successfully
with the limited results above; bounded HTTP/header checks completed and rejected
the candidate. Reviewed new JSON, scripts and archive-prefix metadata;
`git diff --check` passed and `git status --short` was reviewed. No application,
tooling or test changes required lint/typecheck/unit tests or a build in this task.


## Symbol-provider follow-up and reproduction plan

Investigated the provider route after authorization. The working tree was clean
at HEAD `0a146e7` at the start of this follow-up; earlier diagnostic evidence remains
associated with its recorded source revision, not this newer checkout.

Installed Playwright metadata still identifies Chromium revision 1243 as Chrome
for Testing 153.0.8010.12. The saved browser CDP revision is
`971a7443b0c9b0a9b2860529b33331b76077ec62`. The required framework remains ARM64 UUID
`4C4C448E-5555-3144-A1A2-ED142D8DA577`, load address `0x113f3c000` in the saved sample.
A source revision is useful provenance but cannot replace a binary UUID match.

The [CfT provider's documented asset catalog](https://github.com/GoogleChromeLabs/chrome-for-testing#supported-binaries)
lists Chrome, ChromeDriver and Chrome Headless Shell, without a symbol asset or
UUID lookup endpoint. [Chromium's crsym repository](https://github.com/chromium/crsym)
provides parsing libraries but describes its internal server infrastructure as
non-public; it supplies no public symbol backend implementation. It therefore does
not unblock this download. A web-tool request for the per-version CfT JSON failed
to fetch; that failure is not evidence that the version or symbols do not exist.
No guessed symbol-server paths or unrelated-build symbols were used.

Combined with the preceding exact UUID mismatch and the documented CfT limitation,
there is no usable public acquisition route established in these checks. This is
not proof that the build provider lacks internal symbols. No external request was
sent. The identity tuple above plus the existing sample report forms the information
needed for a future provider request; no repository data needs to be published merely
to ask whether that exact UUID is available.

### Concrete alternative, not executed

Use a separate official Google Chrome ARM64 binary with its own matching dSYM,
preferably 153.0.8010.12 beta if that exact binary remains obtainable. The previous
beta dSYM is a candidate for that binary only; verify its UUID against the newly
obtained binary before full symbol download or any application diagnostic. Never
apply it to the saved CfT samples. If an exact compatible pair cannot be obtained,
stop acquisition and report the missing component rather than silently selecting
another release.

[Chromium's macOS debugging guide](https://chromium.googlesource.com/chromium/src/+/main/docs/mac/debugging.md)
documents official Chrome dSYMs and attach restrictions on signed release builds.
First verify that an owned about:blank renderer can be sampled and that its sample
resolves to useful internal functions with the matching symbols. Do not alter SIP,
re-sign an installed browser or weaken system permissions to pass this gate. A
failed attach or unresolved-symbol gate ends collection. A local Chromium build
with symbols is a further option requiring its own acquisition/resource plan,
not a fallback to launch automatically.

Before implementation, record executable path/hash, version, revision, ARM64 UUID,
symbol UUID/hash, acquisition URL and storage requirement (the candidate dSYM
archive alone is 2.59 GB compressed and its framework member is 8.40 GB). Isolate
it from the Playwright browser cache and existing application build. No binary,
symbol archive, dependency or source checkout was downloaded in this follow-up.

The current preflight intentionally pins CfT; it must not be bypassed or made to
accept an unexpected identity. A future diagnostic-only alternate-browser mode
would need an explicit expected identity, the same executable in preflight and
journey, separate metadata, and tests for mismatch, missing symbols, sampler failure,
limits and cleanup. Official benchmark collection must retain its existing profile
and rejection behavior. This mode is planned, not implemented here.

After all gates pass, the bounded experiment is exactly two sequential runs on
one frozen source/build and the same alternate browser: fresh `none`, then
`table-image-paint-off`. Both retain baseline/large-list, seed 20260911, 5,000 records,
viewport, CPU/network/cache policy, native pointer journey, assertions, action and
diagnostic deadlines. Use matching trace and bounded native-sampling instrumentation
in both arms; retain raw reports and verify DOM/source/geometry and pre-render CSS.
No retries, extra probes or existing-trace resymbolication using the new binary.

**Decision criteria:** if the new control does not reproduce the long Layerize and
pre-click stall, stop and report that the browser change prevents transferring the
local observation. If it reproduces, correlate sampled PID/TID/time with Layerize
and inspect named stack paths, especially the residual work under paint-off.
Concentrated named routines can motivate one subsequent mechanism experiment;
counts alone do not prove cause. If sampling misses the span or symbols remain
unresolved, report insufficient attribution and stop. A completed journey on the
alternate browser would not establish a production fix, a speedup or a Docker/CI
result for the original CfT build.

### Validation and remaining blocker

This follow-up only updates this report. Official source review and local metadata
inspection completed. An initial Node import of the unexported `browsers.json`
subpath failed; reading the installed JSON directly succeeded. An outdated registry
source path was absent; no dependency file was modified. No browser, preflight,
build, application test or sampling command ran. Reviewed the added plan;
`git diff --check` passed and `git status --short` shows only this document modified.
The immediate blocker remains obtaining an exact symbol/binary pair for the chosen
route; the existing native stack cannot yet be assigned reliable internal names.


## Beta binary acquisition check

Checked acquisition of the specific alternative pair after authorization, without
running another browser or downloading the full dSYM. The installed application
`/Applications/Google Chrome.app` reports 152.0.7977.83 in its Info.plist and is
not the requested 153.0.8010.12 binary. It was not modified or launched.

The [official Crossbench downloader source](https://chromium.googlesource.com/crossbench/+/e6b1470a2c1c327381b92da6cd3a763668db235b/crossbench/browsers/chrome/downloader.py)
defines a version-specific signed archive layout using `mac-universal` and
`GoogleChromeBeta-<version>.dmg`. Applying that published layout yields:

```text
https://storage.googleapis.com/chrome-signed/desktop-5c0tCh/153.0.8010.12/mac-universal/GoogleChromeBeta-153.0.8010.12.dmg
```

A bounded anonymous HEAD request outside the tool sandbox returned **HTTP 403**.
This establishes an access blocker for that route, not that the object is absent.
No credentials were sought, no authentication bypass attempted and no third-party
archive substituted. Consequently no candidate Mach-O UUID was available to
compare with dSYM UUID `4C4C44B1-5555-3144-A1C4-BEDB1613A45E`.

An earlier unversioned `https://dl.google.com/chrome/mac/beta/googlechrome.dmg`
HEAD request returned 404. That filename was only a candidate and its failure does
not establish the absence of public beta downloads. Google's
[current-package documentation](https://support.google.com/chrome/a/answer/9915669?hl=en)
describes latest-channel packages, not a pinned historical binary. Selecting the
latest beta would violate this step's exact-version gate, so it was not used.

Evidence directory: `artifacts/diagnostics/beta-pair-check-2026-09-13` contains
`beta-head.json`, `exact-beta-head.json`, `result.json` and the two bounded
reproduction scripts (`lab-beta-acquire.py`, `lab-beta-exact.py`). No executable
archive or additional symbols were downloaded.

**Result:** the proposed browser–dSYM pair remains unverified because the exact
binary was not obtained. No alternate-browser mode, preflight, build, sampler or
journey was run. This adds no evidence about Layerize causality or application
performance and does not change the previous timeout conclusions.

To unblock this exact plan, an authorized source must provide the official
153.0.8010.12 macOS ARM64/universal beta binary (or authorized access to that archive).
Then verify its version, signature/provenance and ARM64 framework UUID against the
candidate dSYM before further download or execution. A different browser version
requires an explicitly revised experiment; another identical anonymous request
will not resolve the current access blocker. No provider message was sent.

Only this report changed. Read-only installed-version inspection and HTTP metadata
checks completed with the outcomes above; reviewed the new JSON/scripts and report.
`git diff --check` passed and `git status --short` was reviewed. No code changes
required lint/typecheck/unit tests or production build.


## Alternate Chrome symbol gate

The user explicitly approved changing to another Chrome version with available
binary/symbols. Selected installed Google Chrome 152.0.7977.83, avoiding another
browser download. This is a new diagnostic branch, not permission to reinterpret
old CfT addresses or compare timings across browser versions.

### Verified pair and capability

Installed framework `dwarfdump --uuid` reports ARM64 UUID
`4C4C44C3-5555-3144-A15B-808C73C84BC7` (the universal bundle also has a separate
x86_64 UUID). Used the official
[Google Chrome symbol downloader's URL format](https://chromium.googlesource.com/chromium/src/+/main/tools/mac/download_symbols.py):

```text
https://dl.google.com/chrome/mac/stable/dsym/googlechrome-152.0.7977.83-arm64-dsym.tar.bz2
```

An 8 MiB Range prefix returns 206 and contains a framework DWARF header with the
same ARM64 UUID. Only after that match, a task-owned headless browser was opened
with a fresh temporary context and about:blank. CDP reports Chrome/152.0.7977.83,
revision `79460ebecaa5625e57a5fb679a735659e73dc687`. A one-second/10-ms native sample
of one owned renderer (PID 50642) exits 0; no application route is loaded. This
checks attach capability, not DOM attribution. Browser/session cleanup completes
at 2026-09-13T15:08:32.232Z. No personal browser profile was accessed.

Downloaded only the framework DWARF member through streaming tar extraction to
ignored artifacts, with a 600-second wall deadline and 9,000,000,000-byte output
cap. Archive advertised size is 2,514,135,166 compressed bytes; no full compressed
archive is retained. The complete extracted member is 8,234,743,861 bytes, obtained
in 148.925 seconds, SHA-256:
`5e5d811c5165738980484897f61ecdde1fd1a255d93b6ae5cc425eb9465b3c51`.
Full-file `dwarfdump --uuid` again matches the installed ARM64 framework.

`atos -arch arm64` with the **new sample's** framework load address `0x132e04000`
and eight saved PCs resolves functions including `content::ContentMain`,
`content::ContentMainRunnerImpl::Run`, `content::RendererMain`, `base::RunLoop::Run`,
`base::MessagePumpDefault::Run` and `base::WaitableEvent::TimedWait`. These are idle
startup/message-loop frames, not newly attributed Layerize frames. Exit is 0 but
stderr reports `Unhandled dwarf attribute 58 parsing abbrev table`; function-name
resolution is demonstrated, while source-line/local-variable support is unverified.
No old CfT addresses were passed to these symbols.

`codesign --verify --deep --strict` initially fails inside the tool sandbox. The
same read-only verification outside the sandbox exits 0 with empty stderr; display
identifies Google LLC, TeamIdentifier EQHXZ8M8AV, stapled notarization, and runtime/
restrict flags. Both outcomes are retained, rather than treating the restricted
check as evidence of a modified binary. No re-signing or system security setting
change occurred. Executable/framework hashes are recorded for future identity gates.

### Evidence and next application gate

Evidence directory: `artifacts/diagnostics/stable-pair-check-2026-09-13` contains:

- `archive-prefix-inspection.json`, the 8 MiB prefix and `inspect-prefix.py`;
- `attach-check.cjs` and `attach/{browser.json,processes.json,result.json,sample.txt,cleanup.json}`;
- `fetch-dwarf.py`, `dwarf-download.json`, `Google Chrome Framework.dwarf`;
- `symbolication.json` (commands, resolved functions and warning), `binary-identity.json`.

All scripts are one-off artifact helpers, not official benchmark tooling. The
DWARF is approximately 7.67 GiB and deliberately retained for the next diagnostic;
no dependency or browser-cache content changed.

The alternative pair and basic sampling/symbolication gates now pass with the
stated parser limitation. The next step is a diagnostic-only alternate-browser
identity path and a frozen isolated copy of this verified browser, because an
installed Chrome can update. Recheck hashes/UUID after copying and before each run;
keep the official CfT preflight strict. Follow the previously documented bounded
fresh-control then paint-off plan, with identical instrumentation on this new
browser. A non-reproducing control must stop attribution transfer. No new source
change, build, full preflight or application journey was executed in this gate task.
Old Layerize causality and Docker/CI remain unresolved.

Only this report changed in the repository. Identity/prefix checks, bounded attach,
DWARF download, UUID verification, function symbolication and outside-sandbox code
signature verification completed as described. Reviewed new scripts/JSON/sample
and the document; `git diff --check` passed and `git status --short` was reviewed.
No application/tooling edits required lint/typecheck/unit tests or production build.
