# Frontend Performance Lab

Next.js App Router with React and strict TypeScript. `/baseline` and `/optimized`
implement the shared Live Market Explorer behavioral contract with isolated,
scenario-selected performance experiments. `/reference` provides the reference
explorer; `/case-study` reads validated run records and keeps missing evidence
unavailable. Production benchmark and diagnostic collectors exist, but their raw
artifacts are not automatically published as reviewed performance comparisons.
Mock market endpoints reuse the deterministic dataset and derived summaries.

The Overview page (`/`) introduces the project, walks through using the lab,
and summarizes the engineering challenges of building it in 3 days with AI
support. Overview supports English (default) and Vietnamese through its Language
selector, with matching scenario links to start a
baseline/optimized comparison for every supported scenario, including default.
An explorer-role guide distinguishes Reference (expected functional behavior),
Baseline (the control implementation), and Optimized (a scenario-specific change),
with a 60-record starter link to Reference. Reference is not a speed benchmark.
The guide explains isolated optimizations and provides specific actions with
matching scenario, seed, count, and worker aggregation parameters. Demo links use
60 records (250 for large-list, 3 for image/font delivery) and seed 20260911;
they are interactive demos, not benchmark profiles. Bare `/baseline` and
`/optimized` still use the default scenario and unchanged dataset defaults.

All five pages share the English/Vietnamese language selector in the application
sidebar: Overview, Reference, Baseline, Optimized, and Case Study. The choice stays
active across client-side navigation and browser Back/Forward, and resets to
English on a full reload. The document language updates for assistive technology.
Translations live in `src/i18n/languages/`; components use
`const t = useTranslation()` for labels, instructions, and accessible names.
Known catalog descriptions and failure messages are translated at display time;
API payloads, scenario IDs, dataset names, evidence paths, and raw diagnostic JSON
stay unchanged. Original investigation evidence remains in its source language,
marked as English where applicable. Numeric display follows the selected locale.
No new dependency, dataset change, or benchmark measurement is introduced.

The additional large-list 5,000-record links are for local/dedicated environments
with sufficient response capacity; rendering and interactions may be slow.
The current collection response for seed 20260911 and count 5000 is 9,877,307 bytes
(JSON body, checked locally), exceeding the
[Vercel Functions 4.5 MB response limit](https://vercel.com/docs/functions/limitations).
The full workload is therefore not suitable for that hosting setup. No API,
dataset defaults, or benchmark profiles are changed by these guide links.
Perceived responsiveness and cleanup diagnostics do not establish performance
improvements; Case Study keeps results unavailable until qualified for publication.

The `/optimized` page also offers a Scenario dropdown for every supported
experiment. Selection updates the URL, preserves dataset settings, and resets
experiment interactions. Leaving worker aggregation removes its scenario-only
`aggregationPasses` parameter; only the selected optimization is enabled.

## Git hygiene

`.gitignore` excludes installed dependencies, build caches, generated TypeScript
files, test reports, local benchmark/diagnostic artifacts, generated publication
evidence, local environment files, and Vercel state. Keep source, documentation,
benchmark definitions, public demo assets, and `yarn.lock` in Git. Example
environment files such as `.env.example` remain eligible for Git; use placeholders
instead of credentials. Ignored artifacts stay on disk; archive evidence needed
for published claims according to [the evidence policy](docs/evidence-policy.md).

## Setup

Use Node.js 24 (`nvm use`) and Yarn Classic 1.22.22, pinned in `package.json`.
With Corepack installed, run `corepack enable` to make `yarn` available.
Confirm `yarn --version` prints `1.22.22`. Commit `yarn.lock`; use
`yarn install --frozen-lockfile` for reproducible installs in CI.
Yarn Classic runs dependency install scripts by default, including native bindings.
`@testing-library/dom` is an explicit dev dependency at the previously resolved
version 10.4.1 because Yarn Classic does not automatically install peer dependencies.

```sh
yarn install --frozen-lockfile
yarn playwright install chromium
yarn dev
```

Open the local URL printed by Next.js (normally <http://localhost:3000>).
On Linux CI, use `yarn playwright install --with-deps chromium` to install
browser system dependencies as well.

## Commands

| Command                             | Purpose                                                       |
| ----------------------------------- | ------------------------------------------------------------- |
| `yarn dev`                          | Start the development server                                  |
| `yarn build`                        | Create a production build                                     |
| `yarn start`                        | Serve the production build                                    |
| `yarn lint`                         | Run ESLint with Next.js and TypeScript rules                  |
| `yarn typecheck`                    | Generate Next.js route types and run strict TypeScript checks |
| `yarn test` / `yarn test:unit`      | Run Vitest and React Testing Library in jsdom                 |
| `yarn test:e2e`                     | Run Chromium smoke tests against an existing production build |
| `yarn format` / `yarn format:check` | Write / check Prettier formatting                             |
| `yarn validate`                     | Run lint, formatting, types, unit tests, build, and E2E tests |

Run `yarn build` before standalone E2E tests. Playwright starts and stops its own
production server at `http://127.0.0.1:3100`; that port must be free. It does not
reuse another server. Browser downloads are required once before running E2E tests.

Application routes live in `src/app/`, unit tests are colocated there, and browser
smoke tests live in `e2e/`. Generated output and local environment files are ignored.
The existing `AGENTS.md` describes a different Vite/npm application and has been
preserved; this scaffold follows the requested Next.js/Yarn Classic stack.

ESLint 9 is retained for compatibility with the React plugins bundled by
`eslint-config-next`; ESLint 10 currently fails to load their rules. The registry
marks ESLint 9 as unsupported, so revisit it when those plugins support ESLint 10.

## Shared mock data

`generateMarketRecords` in `src/features/market/data/generate-market-records.ts`
returns fresh `MarketRecord[]` values without React, a network, or wall-clock input.
Call `generateMarketRecords()` for 5,000 records with seed 20260911, or pass
`{ count: 100, seed: 42 }`. Zero records is supported. Counts must be nonnegative
integers within the JavaScript array-length limit (4,294,967,295); practical counts
are limited by available memory. Seeds must be finite numbers, including negative
and fractional values; invalid options throw `RangeError`.

Generator version 1 hashes the numeric seed's string representation with FNV-1a
into a 32-bit linear congruential generator. This is fixture randomness, not
cryptographic randomness; different seeds may collide in the finite state space.
IDs identify record positions and remain stable across seeds and dataset sizes.
Increasing the count preserves the existing prefix for the same seed.

Records contain a name, category, status, USD price (10–10,000, rounded to cents),
volume (0–10,000,000 units), and 24 hourly chart prices. `change` is the percentage
change from the first chart price to the last, rounded to two decimals (within
±25%). The last chart price equals `price`; its timestamp equals `updatedAt`.
Timestamps are UTC and anchored to 2026-09-11T12:00:00.000Z, with each record
updated within the preceding 24 hours. Image metadata includes a self-contained
64×64 SVG data URL and descriptive alt text; no image download is needed.

The schema lives in `src/features/market/data/market-record.ts`. Both future route
implementations must use this shared generator. No simulated update stream or
benchmark evidence is produced by this fixture generator.

## Mock market API

All three Next.js GET endpoints use `generateMarketRecords` with the same inputs:

| Endpoint               | Successful `data` value                                   |
| ---------------------- | --------------------------------------------------------- |
| `/api/markets`         | `MarketRecord[]` in generator order                       |
| `/api/markets/[id]`    | One complete `MarketRecord`, e.g. `market-000001`         |
| `/api/markets/summary` | `MarketSummary` derived from the entire requested dataset |

Every endpoint accepts these optional query parameters:

| Parameter       | Default    | Accepted values                                                                                 |
| --------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| `seed`          | `20260911` | Finite decimal number from −9,007,199,254,740,991 to 9,007,199,254,740,991, including fractions |
| `count`         | `5000`     | Integer from 0 to 10,000                                                                        |
| `delayMs`       | `0`        | Integer from 0 to 5,000 milliseconds                                                            |
| `simulateError` | `false`    | Exactly `true` or `false`; `true` returns a controlled HTTP 500                                 |

Numeric parameters accept decimal scientific notation. Empty values, whitespace,
hexadecimal notation, unknown parameters, repeated parameters, and out-of-range
values return HTTP 400. The API count bound is intentionally smaller than the
generator's array-length limit. `count` defines the dataset size, not pagination;
detail lookup is restricted to that dataset. IDs are matched exactly.

Success returns HTTP 200 with `{ data, meta }`, where `meta` contains
`{ generatorVersion: 1, seed, count, delayMs }`. Shared TypeScript contracts live in
`src/features/market/api/market-api.ts`; record fields retain the generator schema.
Summary fields are `totalRecords`, `totalVolume`, `averagePrice` (USD),
`averageChange` (percentage points), `latestUpdatedAt` (ISO UTC), `byCategory`, and
`byStatus`. Averages are arithmetic means rounded to two decimals; count maps
include every category/status, even when zero. For an empty dataset, totals and
counts are zero, averages and latest timestamp are `null`, and collection is `[]`.

Errors return `{ error: { code, message } }`: HTTP 400 / `INVALID_REQUEST`, HTTP
404 / `NOT_FOUND` for an ID absent from the dataset, or HTTP 500 /
`SIMULATED_ERROR`. Validation happens first and returns immediately. Valid requests
wait for `delayMs` before simulated failure, generation, or missing-record lookup;
the delay is an added wait, not a guarantee of total response time. Error simulation
is explicit and request-local, available in this mock API in all environments so
automated tests can exercise production builds. It takes precedence over lookup
and does not affect concurrent or later requests.

Example: `/api/markets?seed=42&count=100&delayMs=250`. Use the same query on
`/api/markets/market-000001` and `/api/markets/summary` for matching data. Append
`&simulateError=true` to exercise a failure. No dependencies, persistent state,
request cancellation, or deliberate request/caching problems are introduced.

Run `yarn test src/app/api/markets/route.test.ts` for route-handler contract tests,
including deterministic data, query bounds, empty/missing records, fake-timer delay
checks, and isolated error simulation.

## Shared presentation components

`src/features/market/components/` provides the presentation layer for both future
dashboard implementations. All three explorer routes compose these components.

- `DashboardShell` owns the main landmark, heading, composition slots, and a
  discriminated loading/error/success view (including successful empty results).
- `MarketToolbar`, `SearchInput`, and `MarketFilters` expose controlled values and
  callbacks. Parents own search, filtering, refresh, and all request behavior.
- `MarketTable`, `TableHeader`, and `MarketRow` render records in supplied order,
  expose sort/selection callbacks, and label the current sort and record actions.
- `SummaryCards` renders a supplied `MarketSummary`; it does not calculate totals.
- `LoadingSkeleton`, `EmptyState`, and `ErrorState` provide status/alert messages
  and a native Retry button.
- `DetailDrawer` receives a record or `null`, renders its price history, and emits
  `onClose` for its close button and native Escape cancellation. The parent must
  set the record to `null` to dismiss it. Native modal dialog behavior contains
  keyboard focus; opening focuses Close, and cleanup restores the previous focus.

`src/styles/market.css`, imported by the root layout, scopes tokens and rules to
the dashboard/drawer. Rows and skeleton rows reserve 5.5rem, images reserve 4rem,
and charts reserve 13rem. Summary cards use four/two/one columns at desktop,
48rem, and 24rem breakpoints. The table keeps its columns inside a keyboard-focusable
horizontal scroll region on narrow screens. Keyboard focus has a visible outline,
including when a virtualized row transfers focus to its scroll region.
Styles use CSS directly; no Sass or UI dependency is required.

Components contain no fetching, data filtering/sorting, or baseline/optimized
strategy. Tests cover controlled callbacks, supplied order, state transitions,
summary values, and dialog dismissal/focus cleanup under StrictMode. jsdom models
dialog methods for these tests; native browser focus containment is not simulated.

The [shared behavior contract](docs/market-behavior-contract.md) specifies search,
filtering, deterministic ordering, row expansion, detail/keyboard interaction and
refresh/retry semantics for both future dashboards. Pure reference functions live
in `src/features/market/domain/market-query.ts`; stable presentation selectors and
`e2e/helpers/market-journey.ts` support future parity tests. Controllers supply the
optional table `expansion` state/callback to enable accessible expanded rows.
Shared journeys run against all three explorer routes.

## Reference explorer

Open `/reference` (also linked from `/`) for the working Reference Market Explorer.
It loads collection and dataset summary from the mock API, supports name search,
category/status filters, deterministic sorting, independent row expansion, modal
record details with a price-history chart, refresh and Retry. Detail uses the full
record already returned by collection; no additional detail request is needed.
`?seed=42&count=20&delayMs=250` configures a reproducible dataset. Invalid query
parameters show the API error. Refresh preserves controls and dataset configuration,
closes detail and clears expansion. Summary describes the whole dataset.

The reference controller and cancellable loader live in
`src/features/market/reference/`; presentation and domain semantics remain shared.
`/baseline` and `/optimized` now have independent controller/loader entry points with the same initial behavior. This reference renders all matching
rows and makes no performance claims. Unit tests exercise loading/retry and stale
request cleanup; Playwright covers desktop/mobile journeys, modal focus, empty data
and invalid configuration.

## Baseline / optimized parity and visual design

`src/features/market/baseline/` and `src/features/market/optimized/` each own their
controller state, effects, cleanup, loader and route entry. They start from the same
reference implementation; the intentional duplication allows later experiments to
change one lifecycle without changing the other. Presentation, query semantics and
mock APIs remain shared. No bottleneck or optimization is introduced.

`e2e/parity.spec.ts` runs the same journey on both routes at desktop and 390px mobile
width with seed 20260911 and 20 records. Both are checked against the same generator
and query oracle: initial values, summary, numeric ordering, search/filter, expanded
rows, detail content/focus, refresh/loading, empty/error and retry recovery. Held
collection responses make loading assertions deterministic. Run `yarn build` then
`yarn test:e2e e2e/parity.spec.ts` for parity alone. These are behavior checks, not
performance measurements or an assertion about every possible dataset/browser.

The shared frame and warm cream/brown tokens follow the supplied portfolio:
https://richie-doan-personal-portfolio.vercel.app/ (source:
https://gitlab.com/richie.doan/personal-portfolio-website). Sidebar navigation becomes
a horizontal strip on smaller screens. Keyboard navigation and reserved market
row/image/chart sizes are retained. Font stacks name the portfolio's Sora and Plus
Jakarta Sans with system fallbacks; no external font download is required.

Shared UI motion adds short hover/press feedback to buttons and links and a 320ms
fade/slide when a page first appears or its pathname changes. Navigation and request
lifecycles are not delayed or remounted for animation. `prefers-reduced-motion`
disables motion, including cancelling an active page animation when the preference
changes. The same effects apply to baseline and optimized; benchmark runs should
record the motion preference and begin after entry animation has settled.

## Experiment records (no measurements yet)

`src/experiments/data/types/experiment.ts` defines definitions, approaches,
environments, artifacts, measured values, missing results and version-1 runs.
Definitions and the registry cover the ten planned list/search/worker/render,
request/bundle/asset and memory experiments. Each has a separate run module with
`not-available` results and explicit reasons; no benchmark was executed.

Measured values require a finite nonnegative value, declared unit, aggregation,
positive integer sample count, retained `evidence/` path and extraction procedure.
Run validators require metric/unit agreement, complete baseline/optimized result
slots, unique identities and references to raw artifacts with SHA-256 and UTC time.
Unavailable values contain only their status and nonempty reason. Unknown fields,
missing fields, traversal paths and screenshot-only measurement evidence are rejected.

The case-study data reader validates unknown records before use and downgrades
unverified evidence or results other than a median of five samples to unavailable.
Artifact verification is an injected boundary and defaults to unverified: the evidence CLI below now verifies local files/checksums, while the case-study
reader remains fail-closed unless a verifier is supplied. There is no benchmark
runner or publication review automation. Structural validity alone proves neither measurement accuracy nor parity;
the full evidence policy still applies. `/case-study` reads this validated registry
and reports the planned count without displaying invented results. Synthetic numeric
fixtures exist only in validator tests and are not registered as runs.

## Scenario configuration

`/baseline` and `/optimized` accept `scenario=default|large-list|search-input|worker-aggregation|render-boundary|request-lifecycle|bundle-loading|image-font-delivery|interval-memory-leak|listener-memory-leak|detached-dom-memory-leak`.
Observable interactions remain identical across scenarios. Optimized large-list
uses virtualization; search-input uses its isolated request workload described below.
Worker-aggregation, render-boundary, request-lifecycle, bundle-loading, image-font-delivery, interval-memory-leak, listener-memory-leak and detached-dom-memory-leak use their isolated experiments described below; remaining scenarios
introduce no additional workload or leak. Example: `/baseline?scenario=large-list&seed=42&count=100`.

A pure per-navigation parser defaults to `default`, seed 20260911, count 5000 and
zero delay. Numeric bounds match the API: finite seed within ±9007199254740991,
integer count 0–10000, integer `delayMs` 0–5000; `simulateError` accepts true/false.
Unknown, repeated, empty or invalid parameters produce an accessible configuration
error before any API call. Reset configuration navigates to that route's defaults.
No silent fallback is performed for explicitly invalid values.

The reset E2E check keeps the real default API requests (5,000 records), holds
the collection request while entering a search, then verifies successful recovery
and the matching row. This bounds DOM work on shared CI runners without changing
the default dataset or substituting API fixtures. Full-list rendering is checked
separately in `e2e/large-list.spec.ts`.

The API query contains canonical seed/count/delay/error values, never `scenario`;
the API's existing validation and contracts are unchanged. Equivalent numeric URL
representations select equivalent configuration. Changing scenario or dataset resets
that route's local lifecycle; there are no global mutable flags. Refresh retains
configuration. In development only, a small indicator shows scenario, seed and
record count. It is absent from production builds. `/reference` keeps its existing
API-parameter contract and does not select experimental scenarios.

## Evidence directory scripts

Node.js 24 runs these TypeScript scripts directly; no new dependency or benchmark
runner is installed. The repository typecheck permits explicit `.ts` imports for
this Node entry point. Commands use an existing trusted root directory (default:
current working directory), with bundles under `evidence/<experiment>/<run>/`:

```sh
yarn evidence:create --experiment large-list --run trial-001
yarn evidence:validate --experiment large-list --run trial-001 --allow-draft
yarn evidence:validate --experiment large-list --run trial-001
```

Creation refuses an existing run directory. It writes `manifest.json` with actual
scaffold creation time and `status: "draft"`, plus `prompt.md`, `output.md`,
`diff.patch`, `tests.txt`, `environment.json`, `raw-results.json`, and
`human-evaluation.md`. Text documents initially state not-available with a reason;
`diff.patch` is empty until a diff exists. The JSON files contain the shared
unavailable environment/run schemas, not sample measurements. `raw-results.json`
is the `ExperimentRun` record; raw per-sample logs/traces live in additional files
referenced by its artifacts/results. Capture environment facts explicitly rather
than treating the machine running the scaffolder as the measurement environment.

After collection or a documented unavailable outcome, replace the supporting
files, fill the environment and result records, and mark the manifest `complete`.
Keep `environment.json` equal to `raw-results.json.environment`. A complete run may
contain unavailable metrics with reasons; the CLI reports measured/unavailable
counts and does not equate completion with a performance result. `--allow-draft`
is only for scaffold inspection; validation otherwise rejects drafts.

Optional trace, heap and screenshot files may be nested inside the run directory.
Register retained measurement inputs in `artifacts` using safe repository-relative
`evidence/<experiment>/<run>/...` paths, their SHA-256 and collection timestamp.
Use `trace`, `profile` (including heap snapshots), `log`, or `screenshot` kinds.
Measurements must link to raw evidence, not screenshots. Dirty-patch references
must point to that run's nonempty `diff.patch`.

Validation checks required files and manifest/schema metadata, metric units,
aggregation/sample counts, unavailable reasons, environment consistency, artifact
existence and checksums. It rejects absolute/traversing/encoded paths, symlink
components, cross-run artifact references and non-regular files. It does not
execute commands or inspect whether trace contents substantiate a measurement,
recompute medians, validate parity or grant publication approval. The evidence
policy still applies; file integrity alone is not proof of a performance claim.
Validation is read-only. Commands return nonzero on errors.

For a demo without touching real evidence:

```sh
evidence_demo_root=$(mktemp -d)
yarn evidence:create --root "$evidence_demo_root" --experiment large-list --run demo
yarn evidence:validate --root "$evidence_demo_root" --experiment large-list --run demo --allow-draft
# Default validation intentionally fails until the manifest is marked complete.
```

Filesystem and CLI tests create/clean temporary directories. Numeric test fixtures
are explicitly synthetic and never imported by the experiment registry. No actual
run evidence or measurements are committed by this scaffolding task.

### Baseline large-list

`/baseline?scenario=large-list` mounts all 5,000 default records, including those
outside the viewport. Validated `count`/`seed` override the dataset. Search and
filters mount every matching record in the contracted sort order; no pagination
or virtualization is applied. The existing shared table and interactions remain
unchanged. This establishes the baseline full-list strategy. No measurements
are asserted by these DOM correctness checks.

The baseline scenario root exposes `data-render-strategy="baseline-full-list"`,
`data-dataset-count` and `data-dataset-seed`. Existing `market-row` test IDs identify
primary records (excluding expansion rows and skeletons), with `data-market-id`
for identity. `e2e/helpers/large-list-dom.ts` provides on-demand DOM inspection:
rendered row count/IDs, table node count and scenario-root node count. Node counts
include the scope root and all element/text/comment descendants, including hidden
expansion markup. They exclude nodes outside that scope; table count is zero when
no table is mounted. Wait for the expected UI state before sampling. The helper
adds no application observers, timers or DOM traversal during interactions, and
its correctness assertions are not benchmark evidence or performance claims.

### Optimized large-list virtualization

Only `/optimized?scenario=large-list` uses `react-virtuoso` 4.18.13
[`TableVirtuoso`](https://virtuoso.dev/react-virtuoso/api-reference/table-virtuoso/).
The viewport is `min(560px, 70vh)` with 176px overscan on each side (approximately
two collapsed 88px rows per side). The library measures actual row sizes and
expanded rows dynamically; there is no fixed-height clipping of expanded content.
E2E asserts at most 16 primary record rows for the tested default-font desktop and
mobile viewports, including a 5,000-record dataset. This is a DOM correctness bound,
not a timing measurement. The bound can vary with user font/zoom settings.

The optimized controller still loads the same complete deterministic dataset and
uses the existing search/filter/sort functions and summary. `DashboardShell` accepts
a typed table-render callback; header cells, record cells, expansion content and
drawer remain shared presentation. Virtual entries use record ID plus entry kind
as keys, with logical `aria-rowindex`/`aria-rowcount` including expanded entries.
Offscreen records are absent from the DOM; use the search input to reveal a known
record by name. Tab/Shift+Tab traverse all row actions without skipping unmounted
records, ArrowUp/Down move between records, and Home/End reach the first/last result.
Native vertical scrolling and mobile horizontal scrolling remain available.

The drawer restores focus by record ID through the virtual table handle, scrolling
and mounting its opener first if needed. Native scrolling that removes a focused
row transfers focus to the scroll region so arrow navigation can continue. Query
changes reset the list scroll to the top; refresh preserves query controls and
resets expansion, drawer and scroll through the existing loading lifecycle.
`market-virtual-scroll` and `data-render-strategy="optimized-virtual-list"` are
stable scope markers. The region exposes `data-overscan-px="176"`.
No worker, data caching, request optimization, benchmark or measurements are added.
Tests use Virtuoso's geometry context in jsdom and the actual library in Chromium.
Keyboard/browser checks do not replace a manual screen-reader audit.

### Isolated search-input experiment

Use `/baseline?scenario=search-input&seed=20260911&count=40` and the corresponding
`/optimized` URL. Both load the existing deterministic collection/summary once per
refresh. Only this scenario uses a local asynchronous **mock search request** over
that loaded dataset; request counters do not count HTTP calls. There is no new
endpoint and no large-list virtualization, worker or cache mixed into this scenario.

Each issued search performs exactly **12 complete passes** of the existing pure
search/filter/sort selector. The last pass provides the same records/order as the
normal selector. The number of records retains the validated URL bounds/defaults.
After calculation, delivery waits **400ms for trimmed search length 0–1**, otherwise
**60ms**. This deterministic delay models out-of-order responses, without randomness
or dependence on machine speed. CPU execution time itself is not deterministic.

Baseline starts a request for every query update, with no debounce and no cancellation
on supersession. Old requests complete and are counted as stale. It still applies
only the newest generation, so late results cannot violate final-result parity.
Optimized waits **250ms after the last query edit**, aborts in-flight work immediately
on a newer edit (including during the new debounce window), and checks both signal
and generation before applying success or failure. Abort cancels pending delivery;
it cannot interrupt JavaScript's already-running synchronous calculation passes.
Avoided calculations come from debouncing requests that have not started yet.

Initial selection, search edits, category/status changes and sorting use the same
request path. Input/control values update immediately; the table shows the existing
loading state until the latest request completes, followed by success/empty/error.
Summary remains dataset-wide. Refresh/retry reloads the dataset, preserves query
controls, resets expansion/drawer and starts a fresh diagnostic session. All pending
requests/timers are canceled on dataset replacement or unmount, including baseline;
its deliberate missing cancellation applies only to superseding query edits.

The expandable `search-diagnostics` panel exposes `data-request-count`,
`data-calculation-count` (individual completed selector passes), `data-aborted-count`
and `data-stale-count`. `search-completions` contains the last 100 terminal events,
with request ID, search text, `startedAt`, `completedAt` and applied/stale/aborted/error
outcome. Times are actual `performance.now()` milliseconds relative to page origin;
abort timestamps mean cancellation acknowledgment, not successful delivery.
Aggregate counters remain exact within the current dataset lifecycle. Diagnostics
are local observations, not registered benchmark evidence or a speedup claim.
Fake-timer tests cover uncooperative services, late success/failure and cleanup;
Playwright uses a controlled browser clock for reproducible rapid typing journeys.

### Isolated worker-aggregation experiment

`/baseline?scenario=worker-aggregation&seed=20260911&count=60&aggregationPasses=20`
and the corresponding `/optimized` URL use the same pure aggregation. Passes default
to **20**, bounded to integer **1–100**, editable in the aggregation panel. Record
count keeps the existing 0–10000 bounds. `aggregationPasses` is accepted once and
only for this scenario; invalid URL values show the configuration error without
API calls. This option is not sent to market endpoints. Invalid panel input displays
an error, submits no job and cancels any pending worker via session cleanup.

Aggregation selects records using the current name/category/status filters, orders
them by stable ID, and repeats category count/price-cent/volume totals plus an
unsigned 32-bit chart-price checksum for the configured passes. Category order is
fixed; totals describe one pass, not the sum of repeated passes. The checksum
consumes every pass. These synthetic operations are deterministic for the same
seed/dataset/query/passes, including empty results. Chart length is the generator's
existing bounded history. Sorting the table does not change normalized totals.

Baseline executes the pure function synchronously on the main thread. Optimized
sends the same input by structured clone to a new module Web Worker for each job.
A newer query/pass change removes listeners and **terminates** the old worker;
version guards also ignore queued stale messages/errors. A completed or failed job
terminates its worker too. Refresh, invalid input, dataset replacement and route
unmount dispose the session and terminate any active worker. No worker is kept
idle, and no debounce, virtualization, caching or search-input workload is mixed in.
Worker construction/runtime failures produce an error and a Retry aggregation button.

`aggregation-experiment` exposes current job version, started count, running start
time and cancelled count. `aggregation-output` carries the applied result version.
`aggregation-events` retains the latest 50 completed/cancelled/error events, with
version/start/end times. Both timestamps use the page's `performance.now()` clock;
worker end includes startup, serialization, computation and message delivery, not
just worker CPU time. For cancelled jobs, end marks the terminate call, not a
worker-side completion acknowledgment. Counters/history reset with the dataset/session. Cleanup
termination is verified independently in tests because the panel may be unmounted.
These diagnostics are not benchmark evidence and do not establish a Worker speedup.

Unit tests cover exact integer totals, input immutability, bounds and stale worker
callbacks. Browser tests compare actual bundled Worker output with direct output,
exercise rapid changes, and hold dispatch to native Workers to test cancellation/route
cleanup independently of machine speed. The initial dataset and main market UI
continue to use their existing API and behavioral contracts.

### Isolated render-boundary scenario

Open `/baseline?scenario=render-boundary&seed=20260911&count=20` and the corresponding
`/optimized` URL. The dataset summary adds a 160-character Comparison note and an
Explain summary action. Neither changes market data, query, filters or ordering.
Note/explanation state survives search/filter/sort changes, and resets when refresh
unmounts the summary or when navigating to another scenario/dataset.

Baseline owns note state in `BaselineRenderBoundarySummary`. Each note update also
creates a new summary object, display-options object and explanation callback,
invalidating the memoized summary child even though its displayed data is unchanged.
Optimized moves note state to `LocalNoteEditor`, passes the existing immutable
summary reference and constant display options, and stabilizes the explanation
callback. Only `MemoSummaryContent` is memoized: its data is independent of note and
explanation state. No row/table/controller memoization or custom equality checks
are introduced. Genuine summary changes must still render that child.

In development only, `summary-render-commits` counts committed renders of this
summary subtree using a local ref and an effect that updates its own output node.
It does not set React state, install observers/timers or collect durations. StrictMode
may replay mount effects, so use before/after deltas, not absolute mount counts;
these are commit diagnostics, not counts of abandoned render attempts. Production
omits the counter component/effect entirely. The note interaction and intentional
baseline props behavior remain in production; no timing measurements or speedup
claims are recorded.

Unit tests demonstrate additional baseline commits and unchanged optimized counts
for note/parent-only updates, then verify both update on real summary changes.
Production Playwright journeys check behavior, reset semantics, scenario isolation
and absence of counters. Existing baseline/optimized data and lifecycle behavior
outside this scenario remains unchanged.

### Isolated request-lifecycle scenario

Use `/baseline?scenario=request-lifecycle&seed=20260911&count=3` or `/optimized`
with the same parameters. Run request race dispatches two consumers for the first
record (300 ms delivery), then two for the last record (50 ms). These are local
asynchronous mock requests over the loaded deterministic dataset, not extra HTTP
traffic. At least two records are required; running batches cannot overlap.
Baseline deliberately duplicates requests and does not cancel obsolete requests:
the old response temporarily overwrites the new response. After all four settle,
one final latest-record revalidation repairs the result (five requests maximum).
Optimized deduplicates in-flight record keys, aborts obsolete transport, and guards
application/cache writes by version and signal even if transport ignores abort.
Both finish with the last record. Main market interactions remain unchanged.

The optimized per-dataset/session cache holds at most 8 records, FIFO eviction,
TTL 5,000 ms from completion (not extended on hits); expiration is checked lazily
on access. Refresh/navigation/unmount clears it and aborts optimized requests.
Baseline pending timers finish within 300 ms on unmount, but cannot publish after
cleanup. No background polling or retries occur; failures allow a manual retry.
Diagnostics retain only the last 80 events: request ID, start/end/abort, cache hit,
deduplication, apply/ignore, response version and page performance.now timestamp.
These are lifecycle observations, not benchmark measurements. Fake-timer integration
and browser-clock E2E tests verify the stale intermediate baseline result and final
parity; optimized never applies the obsolete version.

### Isolated bundle-loading scenario

Compare `/baseline?scenario=bundle-loading&seed=20260911&count=3` and the equivalent
optimized URL. Both render the same `DetailChart` module and deterministic points.
Baseline statically imports it. Optimized imports it only when a record drawer
mounts; Suspense shows an accessible status with the same 13rem figure / 11rem
content reservation. Close, Escape, focus restoration and reopening work while
loading. No chart library or artificial payload is added.

The drawer receives a typed chart component so it cannot pull the static chart
into the optimized import graph. Outside bundle-loading, optimized starts the
import on mount to preserve eager loading; baseline/reference remain static.
A route bundle cannot conditionally contain a static import based on URL queries.
Lab navigation prefetch is disabled so visiting optimized cannot preload the
static chart through baseline/reference links. Other scenario algorithms are unchanged, but this import-boundary change means
previous bundle measurements should not be compared across builds.

Run `yarn build` then `yarn bundle:analyze` (requires installed Playwright Chromium).
The command starts/stops the production server on port 3100 and writes actual
observations to `artifacts/bundle-loading/report.json`. It uses fresh browser
contexts and records unique JS responses before opening the drawer and additional
JS after opening it, with paths, SHA-256 hashes, decoded bytes and computed gzip
bytes. Totals include shared runtime; gzip is computed locally, not observed wire
transfer size. Build ID, browser/Node versions, seed and count accompany the result.
This is one observation per route, not a timing benchmark or general speedup claim.
The command verifies the chart code is initial on baseline and lazy on optimized;
it fails if bundling no longer honors that boundary. Tests also hold the lazy
request pending to verify the fallback, close/reopen, geometry and identical SVG.

### Isolated image/font delivery scenario

Use `/baseline?scenario=image-font-delivery&count=3` and the matching optimized
route. Three fixed local illustrations and a local Geist font exercise delivery
without altering default market behavior. Baseline uses oversized eager JPEGs,
unreserved image geometry and font swap. Optimized uses AVIF/WebP srcsets, one
high-priority hero, lazy secondary images, reserved placeholders and optional font
with preload. See [asset provenance and licensing](docs/assets-and-licensing.md)
for regeneration, bounds, browser-dependent font behavior and test methodology.
No LCP or CLS measurements have been recorded for this scenario.

### Isolated interval-memory-leak scenario

Use `/baseline?scenario=interval-memory-leak&seed=20260911&count=250` and the
matching optimized URL. A local auto-refresh recalculates volume from at most 250
retained record objects every 1,000 ms. It makes no network requests. Baseline
intentionally keeps this snapshot/timer after unmount but drops its React callback;
optimized clears the timer and releases the snapshot on cleanup, including dataset
changes and StrictMode effect replay. Mounted output is equivalent.

Each interval stops after 20 ticks (about 20 seconds in a foreground tab; browser
throttling may extend elapsed time). A module-local safety budget retains only timer
handles/scalar metadata and caps active intervals at four across SPA navigation;
starting a fifth clears the oldest. No unbounded timer accumulation is possible.
Refresh also unmounts/remounts the experiment. Empty datasets retain an empty sample.
Only this scenario starts the workload; existing request/worker experiments are not
activated. There is no extra poller, DOM retention or deliberate React state update
after unmount.

Performance marks named `interval-memory:<session>:<phase>:<tick>` record start,
tick, unmount, stop and capacity-stop. Detail includes approach, mounted flag,
sampled count/volume and active timer count; at most 100 marks are retained. They
never contain records, callbacks or DOM nodes. These are logical lifecycle signals,
not heap size or GC evidence. StrictMode can start extra baseline sessions in dev;
use the production build for comparisons.

To reproduce with Chrome DevTools:

1. Run `yarn build` and `yarn start`; use a fresh tab for each approach and identical
   seed/count. In Memory, collect garbage and take a pre-scenario heap snapshot.
2. Visit the scenario and navigate using the app's Overview link (SPA navigation,
   not a full reload). Repeat a small fixed number of times, within the 20-tick
   window and below the four-session cap. Record the exact navigation count.
3. Inspect scalar diagnostics with
   `performance.getEntriesByType('mark').filter(e => e.name.startsWith('interval-memory:')).map(e => e.detail)`.
   Baseline should have tick events with `mounted: false`; optimized should stop on
   unmount. Capacity-stop means the safety cap affected this trial; report it.
4. Take a second heap snapshot before automatic expiry; compare retained record
   objects and inspect retainer paths through interval callbacks. Do not log record
   objects or keep console handles to them, which can itself retain them. After all
   sessions stop, collect garbage and take a recovery snapshot. Timer removal alone
   is not proof of immediate collection; the app/dataset may have other retainers.
5. Save real `.heapsnapshot`/trace artifacts, environment, build ID and navigation
   timing to a new evidence run before making any heap claim. No verified heap run
   or retained-byte result is included in this change. Fake-timer/SPA tests establish
   lifecycle behavior only.

### Isolated listener-memory-leak scenario

Open `/baseline?scenario=listener-memory-leak&seed=20260911&count=250` or its
optimized equivalent. A named `retainedMarketListener` on `window` captures at most
250 market record objects and calculates their volume on an explicit probe.
Baseline intentionally does not unregister at component unmount; it drops the React
callback so detached handlers only perform local calculations/marks. Optimized
registers one stable function per effect and removes that exact function with the
same capture flag on cleanup, releasing the snapshot. Dataset changes replace the
optimized handler. StrictMode may double baseline registrations during dev replay.

The approach-specific event names are `market-lab:listener-probe:baseline` and
`market-lab:listener-probe:optimized`. Only an explicit probe activates them; normal
scroll/resize/navigation never dispatches them. No other scenario starts these
listeners, no timer/network work is added, and optimized probes do not activate
baseline leftovers. There is a hard admission cap of eight listeners per approach,
with a visible limit message. Reset experiment listeners dispatches a reset command
that each handler uses to remove itself; refresh then starts a new session. Full
page reload also clears listeners. This explicit safety cap means accumulation
plateaus; it is not an unbounded leak workload.

`listener-memory:<session>:<phase>:<sequence>` Performance marks contain only scalar
session, approach, phase, mounted, sample count/volume and active count. At most 100
marks are retained. Module bookkeeping stores counters/mark names, never handlers,
record arrays or DOM nodes, so instrumentation is not an extra record-retaining root.

Chrome DevTools reproduction (use production build, separate fresh tabs per route):

1. Run `yarn build` and `yarn start`. Take a Memory heap snapshot before entering the
   scenario. Enter it, then use Overview and browser Back repeatedly (SPA navigation;
   do not reload), with a fixed number of cycles below the eight-listener cap.
2. After navigating away, explicitly dispatch
   `window.dispatchEvent(new CustomEvent('market-lab:listener-probe:baseline'))`
   (replace baseline with optimized for the other trial). Inspect scalar marks via
   `performance.getEntriesByType('mark').filter(e => e.name.startsWith('listener-memory:')).map(e => e.detail)`.
   Baseline dispatch marks should accumulate with `mounted: false`; optimized should
   have removal marks and no detached dispatches.
3. Take a second heap snapshot, inspect record objects/arrays and retainer paths
   through Window listeners and the named `retainedMarketListener` closure. Avoid
   logging or saving handler/record objects in the console, which can retain them.
4. Reset with `window.dispatchEvent(new CustomEvent('market-lab:listener-probe:baseline', {detail: {reset: true}}))`, collect garbage and take a recovery snapshot.
   Repeat independently for optimized. Record build/environment, cycles and whether
   the cap was reached; retain actual snapshots in an evidence run before making any
   heap claim. Other app/cache roots may retain the same records; handler removal
   alone does not prove immediate GC or a particular retained-byte reduction.

Component and service tests repeat StrictMode mount/unmount and dispatch events;
SPA browser tests verify native listener behavior after navigation and reset. No
heap measurement or verified heap run is supplied with this implementation.

### Isolated detached-DOM-memory-leak scenario

Use `/baseline?scenario=detached-dom-memory-leak&seed=20260911&count=3` and the
matching optimized URL. Open a record, wait for its chart, then close the drawer.
The actual chart wrapper (`data-testid="detached-chart-root"`) is removed by React;
baseline intentionally captures that root in `retainedDrawerRoots` during ref
cleanup. It is not a clone or a separate hidden fixture. FIFO eviction keeps at
most four roots across repeated cycles and SPA navigation. No timer or listener
experiment is activated. Default drawer rendering remains unchanged.

Optimized stores only the record ID in a bounded four-entry history and clears
that history on wrapper unmount. It does not store the DOM node. Both approaches
render the same chart through the existing drawer; keyboard close/focus restoration
remain unchanged. Reset retained references clears the current cache/history.
Baseline references intentionally survive route unmount until reset, eviction or
full reload. StrictMode ref replay can temporarily capture a still-connected root;
inspect after close, and use a production build for manual comparison.

Inspect retained references reports root count, currently disconnected root count,
contained element count and serializable ID history. It traverses only this cache,
not the browser heap. Its replaceable `detached-dom:<approach>:inspect` Performance
mark contains numbers/strings only. Cached nodes may indirectly retain React data;
four roots does not imply a verified upper bound on retained bytes. Clearing this
cache does not prove that GC ran or that other roots released the same objects.

Manual browser verification:

1. Run `yarn build` and `yarn start`. Use separate fresh tabs, same seed/count and
   six identical open/wait-for-chart/close cycles per approach. Take a pre-cycle
   Memory heap snapshot; after cycles click Inspect retained references.
2. In Edge's Memory tool choose **Detached elements** and start profiling, then
   inspect detached chart roots and their retainers. Availability/naming varies by
   browser; see [Microsoft's Detached elements guide](https://learn.microsoft.com/en-us/microsoft-edge/devtools/memory-problems/dom-leaks-memory-tool-detached-elements).
3. In Chrome use **Memory → Heap snapshot**, take the post-cycle snapshot, filter
   for `Detached`, and inspect the retaining path through the baseline cache/closure.
   Compare with the pre-cycle snapshot using [Chrome's detached-tree workflow](https://developer.chrome.com/docs/devtools/memory-problems).
4. Reset retained references, collect garbage and take a recovery snapshot. Avoid
   saving nodes/handlers in console variables or leaving a selected node as `$0`;
   DevTools itself can retain inspected objects. Record cycles, build/environment,
   cap/eviction state and real snapshot artifacts in an evidence run.

Component tests verify repeated cycles/reference counts under StrictMode; Chromium
E2E checks real DOM removal (`isConnected` via diagnostics), native drawer behavior,
bounded retained element counts, navigation and reset. These are browser lifecycle
observations, not a heap-snapshot analysis. No verified heap run, byte measurement,
or conclusion of memory improvement is included.

### Automated Chrome memory journey

Memory collection uses the recorded `full-dataset-journey-v1` policy: up to 90
seconds for navigation and 90 seconds for the initial table on each route, with
60-second action/assertion deadlines for drawer cycles and a 30-minute overall
collection deadline. Both memory variants
render the full 5,000-record default, so the old 30-second initial assertion and
10-second action limits can expire before rendering completes. Ten cycles,
cleanup, GC and failure handling are unchanged. These are readiness limits, not
memory or speed targets; previous failed artifacts must remain failed.

`yarn memory:journey` defaults to **dry-run**: writes ten planned cycles per route
with unavailable measurements, without launching a browser or forcing GC.
`MEMORY_MODE=test MEMORY_COUNT=3 yarn memory:journey` launches a real browser and
runs all actions but does not collect memory values or force GC. Both are diagnostic
modes, not performance evidence. Build first for test/benchmark modes.

For actual collection:

```sh
yarn build
MEMORY_MODE=benchmark MEMORY_ROUTE=both MEMORY_BROWSER=chrome MEMORY_SCENARIO=detached-dom-memory-leak MEMORY_SEED=20260911 MEMORY_COUNT=5000 MEMORY_CLEANUP_MS=250 MEMORY_OUTPUT=artifacts/memory/my-unique-run yarn memory:journey
MEMORY_OUTPUT=artifacts/memory/my-unique-run yarn memory:validate
```

Options: `MEMORY_ROUTE=baseline|optimized|both` (default both), validated scenario,
seed and count (at least one record), `MEMORY_BROWSER=chromium|chrome` (default
bundled Chromium; Chrome channel requires installed Chrome), cleanup wait 0–5000 ms
(default 250), and `MEMORY_GC=on|off` (on only takes effect in benchmark mode).
The runner owns a production server on localhost:3101 and refuses reuse of an
existing server. It launches a fresh headless browser per approach with identical
flags, viewport 1280×720, locale en-US and timezone UTC. There is no connection to
an existing browser. Forced GC requires benchmark mode plus the launch flag
`--js-flags=--expose-gc`; it calls that owned page's exposed `gc()` only. GC failure
is recorded, never silently treated as success. Without this option normal GC policy
applies. Browser processes and server are closed after collection.

Each approach starts with a cold dashboard load, selects its first visible record,
and performs exactly ten sequential Dashboard → Detail → Dashboard cycles. It waits
for the chart, closes using the shared keyboard/focus journey, waits for the closed
drawer, two animation frames and the configured cleanup interval, then optionally
GCs and samples. No warm-up cycle or outlier is removed. Failed cycles remain with
stage/error and any metrics still obtainable; subsequent cycles continue. A failed
close is explicitly recovered at the next cycle without reloading dataset/cache.
Route/browser setup failure produces ten failed cycles. A failed cycle or cleanup
makes the command exit nonzero after retaining its JSON.

`raw-results.json` includes every cycle, timestamps, GC result, route/scenario,
seed/count, record ID, launch conditions, browser/product/protocol versions, OS/CPU,
Node, build ID, lockfile hash and failures. It is checkpointed after every cycle;
a killed run remains `collecting` and cannot validate. `validation.json` contains a
SHA-256 receipt and failure count. Optional server output is `server.txt`. Output
directories must be new, including when retrying failed runs. The default path is
`artifacts/memory/<mode>-<timestamp>`; tests/demos may use a temporary directory.
No experiment run modules or case-study results are automatically updated. Promotion
still requires the existing evidence package, validation and review policy.

Metrics are single samples: CDP `Runtime.getHeapUsage.usedSize` (bytes) and
`Memory.getDOMCounters.nodes` (nodes), followed by experimental
`DOM.getDetachedDomNodes.detachedNodes.length` (detached tree signal, **not** an
all-process detached node total). Unsupported signals are `not-available` with the
protocol error reason. CDP queries can perturb the browser; the order is fixed for
both approaches. Heap scope is the inspected runtime, not total browser process
memory; values are not proof of a particular retainer or memory improvement.
Drawer-only cycles keep the dashboard mounted, so they do **not** reproduce
interval/listener leaks that require dashboard unmount. Finite scenario caps and
elapsed-time policies still apply. Baseline-first order, one browser run per route,
background system load and missing full source/trace evidence limit comparisons;
this collector does not establish the five reviewed runs required for publication.

### Benchmark environment preflight

Node is pinned to **24.19.0** in `.nvmrc`/engines; Yarn Classic remains **1.22.22**.
Run `yarn benchmark:preflight` to validate the pinned runtime/full Chrome for Testing
and configure/check the 390×844 mobile benchmark environment. It records commit SHA,
OS metadata, source provenance, failures and the five-iteration plan, without running
a comparison. See [the pinned protocol](docs/benchmark-protocol.md#pinned-mobile-environment-mobile-cold-v1)
and `benchmark/profile.json`. Critical mismatches fail; CDP acknowledgement limits
and operator-controlled machine conditions are documented explicitly.

### Journey timeout diagnostics

The GitLab `benchmark` stage has four optional jobs: `benchmark-journey`,
`benchmark-lighthouse`, `benchmark-bundle`, and `benchmark-memory`. Protected
schedules enable them independently with `RUN_BENCHMARKS`, `RUN_LIGHTHOUSE`,
`RUN_BUNDLE`, and `RUN_MEMORY` set to `true`; protected branch pipelines also offer
manual execution. All share the dedicated measurement resource group. Bundle uses
the existing single-observation asset analysis, not a five-iteration timing benchmark.
Only `benchmark-journey` supplies publication; other measurement jobs do not block it.
See [CI configuration](docs/ci.md#manual-and-scheduled-measurements) for outputs.

The GitLab `benchmark-journey` job runs preflight and a paired comparison with five baseline
and five optimized iterations for `BENCHMARK_EXPERIMENT` (default: `large-list`).
It uses the dedicated runner and protected-branch rules. Job artifacts retain
`artifacts/` and `test-results/` even after failure; inspect the current run's
directory under `artifacts/benchmarks/` for raw iterations and `summary.json`.
Diagnostic tracing is a separate command described below.

Use `npm run benchmark:diagnostic -- --dry-run` to inspect the plan without
launching a browser, building, or measuring. `npm run benchmark:diagnostic` runs
preflight, a production build, and one baseline `large-list` journey. Optional
arguments: `<scenario>`, `--route=optimized`, and `--trace=chrome` (default:
`--trace=playwright`). Named `--css-control` values are `none` (default),
`table-container-radius-off`, `table-container-shadow-off`, `table-border-separate`,
`table-button-transition-off`, `table-button-motion-off`, and `table-image-paint-off`.
The image control hides only table images while retaining their DOM, sources and layout.
Overrides exist only
in the diagnostic document and are installed before application rendering; exact
CSS and computed-style/workload snapshots are retained. Dry-run records the selected
control without applying it. Opt-in `--attribution=layers` retains bounded CDP
layer-tree samples, backend-node descriptions and compositing reasons when available;
missing data and CDP timeouts remain explicit in `layer-attribution.json`. It changes
instrumentation and must not be treated as an equivalent performance comparison.
Run probes sequentially. Each invocation creates a unique
ignored `artifacts/diagnostics/` directory; never import it into published evidence.
The total limit is 10 minutes including a one-minute cleanup reserve; collector
readiness and action deadlines remain unchanged. A failed preflight or build
stops dependent work. Tracing modes are separate probes and timings cannot be
used for medians or speedups. See the [diagnostic report and evidence guide](docs/journey-timeout-diagnostic.md).

### Production benchmark runner

Journey collection waits for both real dataset response bodies before starting
the table readiness deadline (90 seconds per phase). Network time remains part
of the measured journey. The versioned readiness policy and phase timings are
retained in evidence; earlier timed-out runs stay failed and unavailable.

Use `yarn benchmark <scenario> --route=baseline` (or `optimized`), or
`yarn benchmark:compare <scenario>` for a paired five-iteration collection.
Start with `--dry-run` to inspect the plan safely. Unique evidence directories keep
raw results, failures and median summaries. See the
[runner protocol](docs/benchmark-protocol.md#production-runner) for measurement
boundaries, cold-cache/zero-warm-up policy and limitations.

Add `--lighthouse` to benchmark/compare commands for pinned Lighthouse navigation
reports (LCP, CLS, TBT, Speed Index, transfer bytes and JS bootup). Original JSON/HTML
reports and per-metric medians are retained. Preflight must pass; `--dry-run` is safe.
On Linux with UID 0, the Lighthouse collector launches Chrome with `--no-sandbox`
for the dedicated CI container; other environments retain the default sandbox.
Field INP stays unavailable without RUM evidence. See the
[Lighthouse policy](docs/benchmark-protocol.md#lighthouse-navigation-collector).

### Opt-in relative regression budgets

`yarn benchmark:budget candidate.json reference.json --metrics=search-duration`
checks verified normalized evidence against baseline (or an explicitly approved
reference hash). Default tolerance is 0%; missing/incompatible evidence never passes.
See [budget input contract and exit semantics](docs/regression-budgets.md).
This command does not run benchmarks or gate shared CI.

### Case study provenance

`/case-study` reads `/api/case-study`, which validates the experiment registry and
only exposes measured values when referenced files are intentionally published
under `public/evidence/`, are regular files without symlink traversal, and match
the record's SHA-256. Medians require five samples. Existing diagnostic artifacts
are not automatically promoted. The checked-in registry remains unavailable; the
journey importer adds verified records and minimal public evidence in the CI workspace.
Charts/percentages compare baseline and optimized within one run/environment with
identical units and extraction definitions. Memory charts additionally require a
`repeated-navigation/` extraction identifier; lab vital charts cover LCP/CLS only.
INP values are excluded because the current record schema has no RUM provenance.
Original extraction accuracy and publication review remain human responsibilities;
file hashes alone do not establish measurement validity. Populated/partial browser
tests intercept the API with explicitly synthetic fixtures and never publish them.

### AI-assistance investigations

Use the [blank investigation template and workflow](docs/ai-investigations.md),
then `yarn investigation:validate record.json [evidence-public-root]`.
The case study shows only verified accepted/rejected records whose evidence exists
and matches its checksum. The registry starts empty; drafts are not published.

### GitLab CI

All CI jobs select the existing Docker runner on Mac with tag
`performance-lab-dedicated`, including checks, E2E and publication. Keep the runner
and Docker Desktop online. Runner protection must allow the pipeline's ref;
unmatched jobs remain pending. Configure the single runner's `limit = 1` externally
to keep other jobs from interfering with benchmark measurements. See
[runner setup and limitations](docs/ci.md#existing-docker-runner-on-mac).

The slim CI image installs Git and CA certificates before dependency installation
so the lockfile check and benchmark commit metadata can run.

The [CI workflow](docs/ci.md) separates checks into six jobs: `ci-validate`, `lint`,
`typecheck`, `unit-tests`, `build` and `e2e`. The first five can run in parallel;
`e2e` downloads the successful `build` job’s `.next/` artifact from the same pipeline
and starts the production server without rebuilding. Every job uses the existing
locked install. Benchmark waits for all six checks, and publication verifies the
latest attempt of each check succeeded. Use `yarn ci:validate` for local YAML
checks. Full performance/memory jobs are manual or scheduled on a dedicated runner;
preflight gates collection and failed artifacts are retained. Merge-gate setup,
retention and local reproduction are documented separately.

Production publication is **implemented and disabled by default**. The CI workflow
requires a successful same-pipeline benchmark job, matching commit/build/environment,
and exactly five valid iterations per approach. It recomputes medians from raw inputs;
failed or partial collections cannot publish measured results. Journey duration is
explicitly automation-inclusive, never INP/LCP. GitLab and deployment boundaries are
covered by local mocked tests; account-backed runner/provider validation remains external.
Once configured, the same
pipeline can run benchmark → import/validate → Vercel production build → output
verification → staged prebuilt deployment → freshness check → promotion. The CLI
pins Vercel 59.16.0 without changing application dependencies. No data commits or
GitLab requests from app visitors are involved. See [publication operations](docs/ci.md#production-publication-opt-in)
for protected variables, Git integration handover, durable evidence, and rollback.

To validate a downloaded journey collection locally without collecting or deploying:

```sh
node scripts/benchmark/import-cli.ts /absolute/path/to/collection --dry-run
```

The source checkout and `yarn.lock` must match the collection. The JSON report is
`reports/publication-import.json`; failures include a sanitized `phase` and `check`
to identify the failing step without exposing credentials. Omit `--dry-run` only in a disposable matching
checkout to import into `src/experiments/data/catalog/published-runs.json` and
`public/evidence/`, then run `npm run build`. Existing experiments/runs are retained.
The repository must include `src/experiments/data/catalog/published-runs.json`
with an empty array (`[]`) before any results are published. The registry imports
this file at build time, so a fresh checkout must not depend on running an importer
first. An empty array leaves the existing unavailable results intact.
Journey duration is the Dashboard → Detail → Dashboard elapsed time in ms, including
automation/network waits; it is not INP, LCP, or algorithm-only time. Exactly five
valid samples per approach from one collection are required; failures/missing
attempts remain unavailable. Lighthouse and memory are not imported by this path.

To verify a real CI benchmark without enabling deployments, set
`PUBLICATION_DRY_RUN=true` on a protected default-branch pipeline and run its
manual `benchmark-journey` job after all six checks succeed. The `publication-dry-run` job
then validates that pipeline's artifact; both reports must say `validated`.
Keep `PUBLICATION_ENABLED` unset. The dry-run flag also suppresses the deployment
job if both flags are present. See [step-by-step CI dry-run](docs/ci.md#dry-run-traceability-retention-and-rollback).

The CI CLI also supports `node scripts/publication/cli.ts --dry-run` under the existing
protected default-branch/production gates, using only the GitLab read token. It downloads
and validates the exact benchmark job without changing UI data or calling Vercel.
Required external configuration and ownership transfer are listed in
[CI publication settings](docs/ci.md#required-settings-and-credentials): GitLab read
credentials, Vercel token/org/project, production origin, first-deployment bootstrap,
and an explicitly enabled protected schedule. These settings are not applied by code.

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



### Combined optimized explorer

Set `ENABLE_OPTIMIZE=1` before building (on Vercel, set it for the deployment environment and redeploy). This enables the translated **Optimized Explorer** option on `/optimized` and its Overview scenario link. Without an explicit scenario, the optimized route selects this combined mode. When enabled, it replaces Default Explorer in the selector and Overview; legacy optimized URLs with `scenario=default` also select the combined mode. Explicit individual scenarios remain isolated; baseline and benchmark scenario defaults are unchanged. Missing or other flag values disable the option.

Use `/optimized?scenario=optimized-explorer&seed=20260911&count=250` to use the default explorer interface with virtualization, debounced search, on-demand charts and existing request/search cleanup. Experiment panels and their extra workloads (images, aggregation, request races, memory probes and comparison notes) remain exclusive to individual scenarios. This mode is not a validated performance measurement. The flag is public build configuration, not a secret.

Expanded virtualized rows show a translated record snapshot with price, history change and range, traded units, record ID and a UTC update timestamp. Range values are derived from the available synthetic history, not a daily trading range.

On small screens, the header stays at the top while scrolling and the menu slides in and out as a right-side modal sidebar with a fading backdrop (animations are disabled for reduced motion) and closes on navigation, Escape or backdrop click. Record details use the same slide and backdrop transitions, respect reduced motion, and also close on backdrop click or the accessible X button. Sort indicators and changing button labels reserve space to keep controls stable. Overview starts with Building the project after the page introduction.

A shared footer uses the same cream and brown palette as the page and credits © 2026 Richie Doan and AI assistance, with English/Vietnamese copy in a compact row that wraps when space is limited.

Expanded virtual rows use a short fade and slide entrance without animating layout height; reduced-motion preferences disable this effect.

The market table sort controls and toolbar remain available during loading, empty and error states; status content appears inside the table body. The table has a translated accessible name without a visible caption, and sort buttons do not move on hover. The market-table test selector still indicates that records are ready.

Table headers highlight the entire cell on hover and use uniform typography and column dividers matching the data rows, with full-width flat sort buttons aligned to cell content. Refresh does not move on hover, and interactive controls use a pointer cursor.

Warm brown and gold accents highlight the scenario selector, active navigation, summary cards and sorted column while retaining the cream page palette.

Overview groups build challenges into responsive cards with a brown introduction panel and gold section accents. Explorer headings and Case Study panels share these colors to distinguish navigation, context and evidence without changing metric status.

Informational cards use warm tinted bodies, distinct title bands and subtle static shadows across Overview, explorer summaries and Case Study. These accents do not encode measurement success or failure.

Cards retain thin borders and tinted surfaces; thick decorative top/side accents and the active navigation stripe are removed.

Sortable table headers always show an indicator: ↕ for an inactive sort column, ↑ for ascending, and ↓ for descending.

Accent colors have consistent roles: teal for actions and optimization, slate for technical context and methods, and terracotta for build challenges and limitations. Overview cards group these subjects with pale backgrounds; evidence status remains determined by its text and validated records.

Market tables use cream rows, subtle alternating stripes, warm taupe headers with dark brown labels, and teal row hover/expanded states. Signed changes retain text alongside teal/terracotta colors; status badges retain Active/Paused/Closed labels. View details has stronger emphasis than Expand. Stripes follow record position, including in virtualized tables.

The market explorer uses ivory summary cards and a neutral scenario panel so the teal Refresh action remains prominent. Row actions use warm neutral colors; controls change color without hover movement, and drawer/expansion motion respects reduced-motion preferences.

On screens up to 768px, market records use vertical cards with translated field labels and a compact sort toolbar. Desktop retains the table layout; optimized lists retain virtualization, expansion and detail navigation.

On mobile, optimized virtual lists scroll with the page so the summary moves out of view, while sort headers stay below the mobile navigation. Mobile cards are measured rather than estimated at desktop row height, with a 600px render buffer in each direction. Desktop keeps the bounded list viewport.
