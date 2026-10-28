# Frontend Performance Lab — Codex Work Prompts

Run these prompts in order. Start each prompt in the repository root. Do not advance to the next step until the current step passes its validation.

## Step 1 — Scaffold the project

```text
You are working in the Frontend Performance Lab repository. Inspect the current repository before making changes and preserve unrelated user changes.

Scaffold or complete a Next.js application using React, strict TypeScript and Yarn Classic 1.22.22. Set `"packageManager": "yarn@1.22.22"`, create and maintain `yarn.lock`, and do not create lockfiles for other package managers. Add placeholder routes for /baseline, /optimized and /case-study. Configure ESLint, Prettier, Vitest and Playwright. Add scripts for dev, build, lint, typecheck, unit tests, E2E tests and validate. Use Yarn for every dependency and package-script command.

Keep this step limited to project infrastructure. Do not implement the dashboard, mock data, performance problems or optimizations yet.

Acceptance criteria:
- All three routes render a simple identifiable placeholder.
- TypeScript strict mode is enabled.
- A minimal unit test and E2E smoke test pass.
- A production build succeeds.

Run lint, typecheck, unit tests, relevant E2E tests and production build. Fix failures within scope. At the end, report changed files, command results, assumptions and remaining limitations. Do not commit unless explicitly asked.
```

## Step 2 — Establish project documentation

```text
Inspect the Frontend Performance Lab repository and its existing documentation. Create or update these documents: docs/project-scope.md, docs/architecture.md, docs/benchmark-protocol.md and docs/evidence-policy.md.

The repository uses Yarn Classic 1.22.22. Use Yarn syntax in all commands and documentation, treat `yarn.lock` as the only package-manager lockfile, and do not introduce lockfiles for other package managers.

Document the following decisions:
- Product: generic Live Market Explorer.
- Routes: /baseline, /optimized and /case-study.
- Baseline and optimized must have identical UI, data, features and observable behavior.
- Default dataset: 5,000 deterministic records using seed 20260911.
- Measurements use fixed conditions and the median of five valid runs.
- Do not publish unsupported performance claims.
- Every measured value must link to raw evidence; missing results remain unavailable.
- Lab metrics must not be mislabeled as field INP.
- Each isolated experiment changes one primary implementation variable.

Include explicit non-goals, experiment invariants, evidence requirements and the intended repository architecture. Do not add implementation code in this step.

Validate internal links and consistency with the existing repository. Report changed files and unresolved decisions.
```

## Step 3 — Implement deterministic market data

```text
Inspect the current repository, project types and test conventions. Implement a deterministic TypeScript mock-data generator for the Live Market Explorer under shared code.

The repository uses Yarn Classic 1.22.22. Use Yarn for all dependency and package-script commands, preserve `yarn.lock`, and do not create lockfiles for other package managers.

Define a MarketRecord model containing a stable ID, name, category, status, price, change, volume, updatedAt, image metadata and chart history. Support configurable record counts, with 5,000 as the default, and a configurable numeric seed, with 20260911 as the default. The same seed and count must always produce structurally identical output. Do not call Math.random directly outside a seeded generator.

Add unit tests proving determinism, count correctness, stable unique IDs, valid value ranges and different output for different seeds. Keep the generator independent from baseline and optimized implementations.

Do not implement API routes or UI in this step. Run lint, typecheck and relevant unit tests. Report changed files and validation results.
```

## Step 4 — Implement the mock API

```text
Inspect the existing data generator and application conventions. Implement mock API endpoints for market collection, market detail and summary data. Reuse the deterministic generator rather than creating a second source of data.

The repository uses Yarn Classic 1.22.22. Use Yarn for all dependency and package-script commands, preserve `yarn.lock`, and do not create lockfiles for other package managers.

Support explicit seed, record count and simulated delay parameters with validated bounds and safe defaults. Provide a controlled way to simulate an error for automated tests. Define stable response schemas and return appropriate HTTP status codes for invalid requests and missing records.

Add contract tests covering deterministic responses, validation, missing records, delay configuration and error simulation. Do not implement deliberate duplicate requests, caching problems or request cancellation yet.

Run lint, typecheck, relevant tests and production build. Report changed files, endpoint contracts and validation results.
```

## Step 5 — Build shared presentation components

```text
Inspect the application and establish a reusable presentation layer for the Live Market Explorer. Create shared visual components for the dashboard shell, toolbar, search input, filters, table header, market row, summary cards, loading skeleton, empty state, error state and detail drawer.

Create shared design tokens and responsive layout rules. Components should receive data and callbacks through typed props and must not own baseline-specific or optimized-specific data-processing behavior. Reserve stable dimensions for rows, images, skeletons and chart areas. Include semantic HTML, labels and basic keyboard/focus behavior.

Add focused component tests where they provide value. Do not implement virtualization, Web Workers, artificial memory leaks or performance claims.

Run lint, typecheck, relevant tests and production build. Report changed files, shared component boundaries and validation results.
```

## Step 6 — Define the behavioral contract

```text
Inspect the market data, API and shared components. Define the observable behavioral contract that both /baseline and /optimized must satisfy.

Cover search by name, category filter, status filter, price and volume sorting, row expansion, opening and closing the detail drawer, refresh semantics, loading state, empty state, error state and keyboard interaction. Implement pure shared domain functions only where sharing does not invalidate the performance comparison. Define stable test selectors and reusable Playwright journey helpers.

Add unit tests for search/filter/sort correctness and document important ordering and refresh semantics. Do not build the two different performance implementations yet.

Run lint, typecheck and relevant tests. Report the contract, changed files and validation results.
```

## Step 7 — Build the reference dashboard

```text
Using the existing data, API, visual components and behavioral contract, implement one correct reference Live Market Explorer dashboard. It must load the deterministic dataset and support all agreed user interactions, detail chart display, refresh behavior and responsive mobile layout.

Prioritize functional correctness and clear component boundaries. Do not deliberately add performance problems, memory leaks or advanced optimizations. Do not claim this implementation is baseline or optimized yet.

Add or update tests for the complete reference user journey. Run lint, typecheck, unit tests, relevant E2E tests and production build. Report changed files, completed behaviors and limitations.
```

## Step 8 — Wire routes and enforce parity

```text
Inspect the reference dashboard and route structure. Wire /baseline and /optimized to separate implementation entry points while initially preserving identical observable behavior. Avoid duplicating presentation code unnecessarily, but keep implementation-specific data and lifecycle logic separable.

Create a parameterized Playwright parity suite that runs the same journeys against both routes. Verify equivalent initial data, search results, filter results, sort order, detail content, refresh semantics, loading/error states and important accessibility behavior. Use deterministic seed 20260911.

Do not add deliberate bottlenecks or optimizations yet. Run lint, typecheck, unit tests, parity tests and production build. Report changed files and parity results.
```

## Step 9 — Define experiment records

```text
Inspect existing experiment-related code and documentation. Implement typed schemas for experiment definitions, approaches, environments, artifacts, measured values, missing results and experiment runs. Create an experiment registry without inventing measurements.

Every measured value must include value, unit, aggregation method, sample count and an evidence path. Represent unsupported or absent information explicitly as not-available with a reason. Add schema/runtime validation for records loaded by the case study.

Create empty or unavailable run modules for the planned experiments without fabricated results. Add unit tests for valid records, invalid records, missing evidence references and unavailable results.

Do not implement benchmark execution in this step. Run lint, typecheck and relevant tests. Report the schema and validation results.
```

## Step 10 — Implement scenario configuration

```text
Implement deterministic experiment scenario selection for /baseline and /optimized. Support at least default, large-list, search-input, worker-aggregation, interval-memory-leak, listener-memory-leak and detached-dom-memory-leak.

Read scenario, seed and record count from validated URL parameters. Use safe defaults and bounded values. Do not use global mutable flags. In development, display a small non-intrusive indicator of the active scenario and dataset configuration. Ensure invalid parameters fall back predictably or produce a documented validation response.

Add unit and E2E tests for valid scenarios, invalid scenarios and deterministic configuration across both routes. Do not implement the scenario-specific problems yet.

Run lint, typecheck, relevant tests and production build. Report changed files and validation results.
```

## Step 11 — Create evidence scaffolding and validation

```text
Inspect the experiment schemas and evidence policy. Implement scripts to create an evidence directory for a specific experiment run and validate a completed run.

The generated run directory should support prompt.md, output.md, diff.patch, tests.txt, environment.json, raw-results.json, human-evaluation.md and optional trace, heap or screenshot artifacts. Do not create fake measurements. Validation must verify required metadata, safe relative evidence paths, referenced-file existence, measurement units, aggregation metadata and the rule that unavailable values need a reason.

Add package scripts with clear usage, automated tests for valid and invalid fixtures, and concise documentation. Do not collect performance measurements yet.

Run lint, typecheck and relevant tests. Demonstrate the create and validate commands using a fixture or temporary directory that does not pollute real evidence. Report results.
```

## Step 12 — Implement baseline large-list scenario

```text
Implement only the baseline side of the large-list experiment. When /baseline uses scenario=large-list, render all configured records, including 5,000 by default, without list virtualization. Preserve the complete behavioral contract and shared UI.

Keep this experiment isolated: do not add artificial network problems, memory leaks, blocking chart work or unrelated regressions. Add instrumentation or stable markers needed to count rendered rows and DOM nodes without changing behavior.

Add tests confirming all records are represented in the baseline DOM for this scenario and interactions remain correct. Do not implement or measure the optimized side yet.

Run lint, typecheck, unit tests, relevant parity/E2E tests and production build. Report changed files and validation results.
```

## Step 13 — Implement optimized virtualization

```text
Implement the optimized side of the large-list experiment using a suitable React virtualization library. When /optimized uses scenario=large-list, render only the visible window plus a small documented overscan while preserving the same data, UI, sorting, filtering, detail drawer and user-visible results as baseline.

Preserve keyboard accessibility, stable row identity, scrolling and the ability to open a known record. Do not add unrelated optimizations. Add tests proving functional parity and a bounded number of rendered row elements rather than assuming virtualization works.

Run lint, typecheck, unit tests, parity/E2E tests and production build. Report the virtualization configuration, changed files and validation results. Do not invent performance numbers.
```

## Step 14 — Implement the search-input experiment

```text
Implement the isolated search-input experiment for both routes.

Baseline behavior: perform the expensive search/filter path after every relevant keystroke and allow request work to proceed without cancellation. Optimized behavior: debounce search using a documented delay, cancel obsolete requests with AbortController and prevent stale results from replacing newer results.

Both routes must eventually show identical results for the same final query. Make the workload controlled and reproducible without freezing the browser. Instrument request count, calculation count and completion timestamps for benchmark collection.

Add fake-timer unit tests and E2E tests covering rapid typing, request cancellation and stale-response protection. Keep large-list and other experiments isolated.

Run lint, typecheck, relevant tests and production build. Report changed files, chosen debounce delay and validation results. Do not report unmeasured speedups.
```

## Step 15 — Implement the aggregation/Web Worker experiment

```text
Implement the isolated worker-aggregation experiment.

Create a deterministic aggregation workload using the shared dataset. Baseline must execute the aggregation synchronously on the main thread. Optimized must execute equivalent work in a Web Worker, ignore or cancel obsolete jobs and terminate the worker during cleanup. Both routes must produce byte-for-byte equivalent normalized aggregation results.

Keep the workload configurable and bounded. Add instrumentation for job start/end, result version and cancellation. Add unit tests for the pure aggregation logic, equivalence tests between direct and worker execution, and E2E tests for rapid input changes and cleanup.

Run lint, typecheck, relevant tests and production build. Report changed files, worker lifecycle design and validation results. Do not claim the Worker is faster until benchmark evidence exists.
```

## Step 16 — Implement the render-boundary experiment

```text
Implement an isolated render-boundary scenario for both routes. Create a reproducible interaction where baseline state placement and unstable props cause unnecessary child renders. In optimized, localize state, introduce stable props and apply React memoization only at boundaries justified by the scenario.

Add development-only render counters or React Profiler-compatible marks that do not materially alter production measurements. Verify both routes maintain identical behavior and output. Add tests for behavior and instrumentation, but do not assert fragile wall-clock durations in unit tests.

Run lint, typecheck, relevant tests and production build. Report which component boundaries changed and why. Do not add memoization outside this scenario without evidence.
```

## Step 17 — Implement request lifecycle comparison

```text
Implement an isolated request-lifecycle experiment.

Baseline should reproducibly demonstrate duplicate requests, lack of cancellation and a controlled stale-response race. Optimized should deduplicate equivalent in-flight requests, abort obsolete requests, reject stale results and use a bounded cache with documented TTL and maximum size.

Both routes must converge to the same correct state. Provide instrumentation for request IDs, start/end/abort state, cache hits and applied response version. Add integration and E2E tests that deterministically reproduce the race and prove the optimized route does not apply stale data.

Do not introduce production-unsafe infinite traffic or an unbounded cache. Run lint, typecheck, relevant tests and production build. Report changed files and validation results.
```

## Step 18 — Implement bundle-loading comparison

```text
Implement an isolated bundle-loading experiment around the detail chart.

Baseline should statically include the selected charting code in its initial route bundle. Optimized should load the same chart functionality through route/component-level dynamic import only when needed, with a dimensionally stable accessible loading fallback. Preserve the same chart data and visible output.

Add tests showing the optimized chart loads on demand and the drawer remains usable. Add a reproducible bundle-analysis command or build artifact parser that can report initial and lazy JavaScript sizes without hand-entered values.

Run lint, typecheck, tests, production build and the bundle analysis. Save only actual generated evidence when running an experiment. Report changed files and measured build artifact paths, but do not generalize beyond the collected data.
```

## Step 19 — Implement image and font comparison

```text
Implement an isolated image/font delivery experiment while keeping content and layout visually equivalent.

Baseline should use intentionally oversized eager images, omit intrinsic dimensions in the controlled scenario and use a font-loading strategy capable of causing measurable layout instability. Optimized should use responsive modern image formats, lazy loading outside the viewport, appropriate priority for the LCP candidate, reserved dimensions and a stable font strategy.

Keep the scenario safe, deterministic and clearly separated from the default experience. Add tests for image attributes, dimensions, loading priority and layout placeholders. Update asset documentation and licensing notes.

Run lint, typecheck, relevant tests and production build. Report changed files and validation results without inventing LCP or CLS values.
```

## Step 20 — Implement interval memory-leak experiment

```text
Implement an isolated interval-memory-leak experiment.

Baseline must create a controlled auto-refresh interval that remains active after the relevant component unmounts and retains a meaningful reference. Optimized must clear the interval during cleanup and avoid stale retained closures. Limit the scenario so it cannot create unbounded visible updates or destabilize normal development.

Add fake-timer tests that repeatedly mount and unmount the component, prove the baseline retains active work and prove the optimized implementation returns to the expected timer count. Add stable instrumentation for navigation-based memory measurement.

Run lint, typecheck, relevant tests and production build. Document how to reproduce the leak in Chrome DevTools. Do not record heap claims unless a verified run is performed.
```

## Step 21 — Implement event-listener memory leak

```text
Implement an isolated event-listener memory-leak experiment.

Baseline must register a controlled browser event listener that is not removed on unmount and whose handler retains relevant component data. Optimized must use a stable handler reference and remove exactly that listener during cleanup. Ensure normal routes and other scenarios are unaffected.

Add tests that repeat mount/unmount cycles, dispatch the event and demonstrate accumulated baseline handlers versus stable optimized behavior. Add instrumentation suitable for heap-retainer inspection and document manual reproduction steps.

Run lint, typecheck, relevant tests and production build. Report changed files and verified test behavior. Do not fabricate detached-node or heap measurements.
```

## Step 22 — Implement detached-DOM memory leak

```text
Implement an isolated detached-DOM memory-leak experiment associated with repeated detail drawer open/close cycles.

Baseline must remove DOM nodes visually while retaining references through a controlled closure or cache. Optimized must store serializable identifiers/data instead of DOM nodes and clear or bound retained state according to lifecycle. Keep the deliberate leak limited to the baseline scenario.

Add tests for repeated cycles and retained-reference instrumentation. Document how Detached Elements and Heap Snapshot tools can verify the problem. Avoid relying solely on jsdom for claims that require a real browser.

Run lint, typecheck, relevant tests and production build. Report changed files and limitations. Do not claim memory improvement before a verified browser run.
```

## Step 23 — Build the combined memory journey

```text
Create an automated Chrome-based memory journey that repeats Dashboard → Detail → Dashboard ten times for a selected route and scenario. After each cycle, allow cleanup, invoke garbage collection only in a benchmark browser explicitly launched with the required flag, and record used heap, DOM node count and any supported detached-node signal.

Record every cycle, browser/version settings, route, scenario, seed and failures in raw JSON. Do not silently discard outliers or failed cycles. Keep baseline and optimized execution conditions identical. Add a dry-run/test mode that validates orchestration without making performance claims.

Do not add results to experiment run records unless the artifacts were actually produced and validated. Run lint, typecheck and relevant tests. Report usage and known limitations.
```

## Step 24 — Lock benchmark environment

```text
Implement and document a reproducible benchmark environment configuration. Pin the supported Node/Yarn Classic 1.22.22 versions and Chrome for Testing version where practical. Define mobile viewport 390x844, CPU throttling, network profile, dataset seed 20260911, default 5,000 records, cache state and five measured iterations.

Create a machine-readable environment schema and a preflight command that reports and validates actual conditions. It must fail clearly when critical conditions differ instead of silently claiming comparability. Include commit SHA and operating-system metadata in generated environment artifacts.

Do not execute or publish benchmark comparisons in this step. Run validation tests for accepted and rejected environment fixtures and report results.
```

## Step 25 — Implement the benchmark runner

```text
Implement a benchmark runner for a named experiment and route. It must run against a production build, execute a documented warm-up policy, perform five measured iterations, preserve each raw result, record failures and calculate the median for supported metrics.

Provide commands equivalent to:
- yarn benchmark <experiment> --route=baseline
- yarn benchmark <experiment> --route=optimized
- yarn benchmark:compare <experiment>

The runner must never select the best run, silently remove an outlier or overwrite a previous run without explicit intent. Write results into a unique evidence run directory and link summaries to raw inputs. Include a safe dry-run mode for CI tests.

Add tests for median calculation, failed iterations, unique run IDs and evidence generation. Run lint, typecheck and relevant tests. Do not invent benchmark output.
```

## Step 26 — Add Lighthouse collection

```text
Integrate Lighthouse collection into the production benchmark workflow under the fixed environment policy. Capture supported lab metrics such as LCP, CLS, TBT, Speed Index, transfer size and JavaScript execution information for each iteration, retaining the original Lighthouse report.

Do not label TBT or a synthetic interaction duration as INP. Represent field INP as unavailable unless real field/RUM evidence exists. Ensure baseline and optimized use identical Lighthouse configuration and cache policy. Aggregate using the documented median method.

Add configuration validation and tests around result parsing. Run a dry run or a real local run only if the environment passes preflight, and clearly distinguish produced evidence from test fixtures. Report validation results and limitations.
```

## Step 27 — Add regression budgets

```text
Implement performance regression-budget validation based on verified benchmark summaries. Initially compare optimized against baseline or a committed approved reference for initial JavaScript bytes, long-task count, DOM node count and search duration. Do not invent absolute targets before stable measurements exist.

Define metric direction, units, missing-value behavior and tolerances explicitly. Missing or incompatible evidence must produce unavailable/invalid status rather than a pass. Add tests for improvement, regression, missing data, incompatible environments and noisy values near tolerance.

Integrate the validator as an opt-in command, not a mandatory shared-runner CI gate yet. Run lint, typecheck and relevant tests. Report changed files and budget semantics.
```

## Step 28 — Generate the case-study page from evidence

```text
Implement /case-study as an evidence-driven page that reads validated experiment run records rather than hard-coded performance numbers.

Show experiment purpose, baseline and optimized approaches, fixed environment, median/sample count, supported comparisons, direct evidence references, limitations and unavailable states. Include appropriate visualizations for Core Web Vitals lab results, runtime metrics and repeated-navigation memory trends only when compatible data exists.

Do not show INP unless field evidence exists. Do not calculate percentages across mismatched units or environments. Make the page responsive, semantic and accessible. Add unit tests for data transformation and E2E tests for populated, partial and unavailable records.

Run lint, typecheck, relevant tests and production build. Report changed files and the data provenance path.
```

## Step 29 — Add AI-assistance decision records

```text
Implement an AI-assistance investigation log format and documentation. Each record must include the investigation question, AI-generated hypothesis, evidence inspected, source locations, decision, accepted/rejected status, reasoning, related diff and before/after measurement references when available.

Add validation ensuring an AI suggestion cannot be marked verified without evidence. Create templates, not fictional completed investigations. Update the case-study page to display verified accepted and rejected suggestions only when records exist.

Document a repeatable workflow: record trace, identify bottleneck, ask AI, inspect evidence/source, make one change, remeasure under identical conditions, accept or reject. Run lint, typecheck and relevant tests. Report changed files and validation results.
```

## Step 30 — Complete SEO and accessibility

```text
Audit and implement the agreed SEO and accessibility scope for the Frontend Performance Lab.

Add unique metadata, canonical URLs, Open Graph data, sitemap and robots configuration. Ensure the case-study narrative is crawlable and does not depend entirely on client-side rendering. Use semantic headings and landmarks. Verify keyboard operation, focus management and restoration for the drawer, form labels, status announcements, color contrast and reduced-motion behavior.

Do not claim that an accessibility score is an SEO metric, and do not attempt to index all 5,000 dashboard records. Add automated accessibility smoke tests where supported and document remaining manual checks.

Run lint, typecheck, tests and production build. Report findings, changes and unresolved manual checks.
```

## Step 31 — Configure CI

```text
Inspect the repository hosting environment and add a CI pipeline for deterministic correctness checks: dependency install with lockfile, lint, typecheck, unit tests, parity/E2E tests and production build. Cache dependencies safely without hiding lockfile changes.

Keep full performance and memory benchmarks manual or scheduled unless the runner environment is dedicated and validated. Add an opt-in scheduled/manual benchmark job that preserves artifacts and runs preflight before measurement. It must not publish claims from an invalid environment.

Document branch/MR behavior, required checks, artifact retention and how to reproduce failures locally. Validate the CI configuration using available local tools and run the corresponding local commands. Report changed files and limitations.
```

## Step 32 — Final project verification

```text
Perform a final verification of the Frontend Performance Lab. Begin with read-only inspection of repository status, documentation, scripts, experiment registry and evidence. Preserve unrelated changes and do not fabricate or backfill missing results.

Scope note:

* Step 30 was intentionally skipped.
* The SEO baseline audit, SEO implementation and before/after comparison will be developed later as a separate experiment.
* Do not implement SEO during Step 32.
* Do not report SEO as completed.
* Missing SEO measurements must remain `not-available` or `deferred`, with a clear reason.
* README or the project roadmap must explicitly identify the SEO experiment as deferred.

Verify:

* Clean dependency installation is documented and reproducible.
* Lint, typecheck, unit tests, parity/E2E tests and production build pass.
* `/baseline` and `/optimized` satisfy the same behavioral contract.
* Each experiment is isolated and reproducible.
* Experiment records validate and every measurement links to existing evidence.
* Missing measurements remain unavailable.
* Case-study numbers are generated from validated records.
* Lab metrics are labeled accurately.
* README explains setup, scenarios, benchmarks, evidence and limitations.
* No unsupported SEO, indexing or ranking claims exist.
* CI and local commands consistently use Yarn Classic 1.22.22.

Fix only clearly in-scope defects discovered during verification. Do not execute expensive benchmarks unless explicitly requested and the environment passes preflight.

Produce a final readiness report grouped into:

* Passed checks.
* Remaining blockers.
* Unverified measurements.
* Deferred scope, including the SEO experiment.
* Recommended next action.

If the core project is ready but SEO remains deferred, use this conclusion:

`Core performance lab ready; SEO experiment deferred.`

Do not claim that the project has completed full SEO verification.

```

## Standard instruction to append when needed

Use this addition when the repository is already under active development:

```text
Before editing, inspect git status and relevant files. Existing changes belong to the user. Preserve them, avoid broad rewrites and do not modify unrelated experiments or run records. Use the repository's existing conventions when they conflict with assumptions in this prompt. Ask only if a missing decision would materially change the implementation.
```
