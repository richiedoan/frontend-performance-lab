# Architecture

## Existing repository

The current stack is Next.js App Router, React, strict TypeScript, Node.js 24, and
Yarn Classic 1.22.22, as declared in [package.json](../package.json) and
[tsconfig.json](../tsconfig.json). Shared market types and a deterministic generator now live in
`src/features/market/data/`, with colocated unit tests. Explorer entry points live
in `src/features/market/{baseline,optimized,reference}/`; collectors live in
`scripts/{benchmark,memory,bundle}/`. Case-study records/validation live in
`src/experiments/data/` and are served through `/api/case-study`.

| Existing path                                      | Responsibility                                |
| -------------------------------------------------- | --------------------------------------------- |
| `src/app/layout.tsx`                               | Root document, language, and metadata         |
| `src/app/page.tsx`                                 | Home page linking to the three lab routes     |
| `src/app/{baseline,optimized,case-study}/page.tsx` | Explorer variants and validated case-study UI |
| `src/app/pages.test.tsx`, `src/test/setup.ts`      | Colocated unit tests and jsdom setup          |
| `e2e/routes.spec.ts`                               | Chromium route and navigation smoke tests     |
| `next.config.ts`                                   | Next.js configuration and React Strict Mode   |
| `vitest.config.ts`, `playwright.config.ts`         | Unit and browser test configuration           |
| `eslint.config.mjs`, `.prettierrc.json`            | Lint and formatting configuration             |
| `yarn.lock`                                        | Pinned Yarn Classic dependency resolution     |

Vitest uses Vite tooling for tests; Vite does not serve the application. Playwright
currently starts a production server and runs smoke tests in parallel. Those tests
are not a performance benchmark. See [README](../README.md) for existing commands.

The preserved [AGENTS.md](../AGENTS.md) describes an older Vite/npm Notification
Center application that is absent from this repository. These documents follow
the explicitly requested Next.js/Yarn Classic product direction; they do not rewrite that
instruction file. Its applicable coding, accessibility, and change-scope guidance
still informs future work. Next.js automatic agent-file generation is disabled.

## Intended structure

The following table describes the target responsibilities. `src/app/`, `e2e/`,
and the market types and generator under `src/features/market/data/` already exist;
the other feature and measurement directories remain planned. Add them only as
implementation needs arise.

| Intended path                       | Responsibility                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/app/`                          | Thin route composition, root layout, and route metadata                                      |
| `src/features/market/data/`         | Record types, deterministic generator, seed and dataset defaults, reproducible update inputs |
| `src/features/market/components/`   | Shared presentation and accessible controls where sharing preserves the experiment boundary  |
| `src/features/market/baseline/`     | Reference implementation internals                                                           |
| `src/features/market/optimized/`    | Alternative implementation internals                                                         |
| `src/experiments/components/`       | Comparison and case-study presentation                                                       |
| `src/experiments/data/definitions/` | Experiment hypotheses, primary variables, invariants, and scenarios                          |
| `src/experiments/data/runs/`        | Evidence references and run manifests, separate from synthetic product data                  |
| `src/experiments/data/types/`       | Shared experiment and evidence types                                                         |
| `src/experiments/data/catalog/`     | Experiment lookup and registration                                                           |
| `src/experiments/data/validation/`  | Evidence completeness and comparability checks                                               |
| `src/experiments/data/summaries/`   | Derived medians and claim inputs with provenance                                             |
| `src/styles/`                       | Shared styling for visual parity                                                             |
| `e2e/`                              | Feature and parity browser tests                                                             |
| `benchmarks/`                       | Dedicated sequential measurement scenarios and collection tooling                            |
| `evidence/`                         | Proposed durable raw artifacts and manifests, or a documented external artifact index        |

## Boundaries and data flow

Both route implementations consume the same deterministic dataset contract:
5,000 records, seed 20260911, identical generator version and inputs. Data generation
must be independent of React and the DOM. Variant code must not silently substitute
data or change the workload. Shared presentation must not force the implementation
variable under test to be identical; equivalent output remains mandatory.

Keep route composition separate from feature state and implementation strategies.
Use local React state unless a later task explicitly requires another approach.
Do not introduce real services, persistence, or additional libraries merely to
support this intended directory structure. Keep tests beside the modules they
verify and retain browser tests for observable parity.

Measurement tooling produces raw artifacts and manifests. Validated manifests feed
derived summaries, which feed `/case-study`. Case-study rendering must not invent
fallback numbers or collect measurements implicitly during a page visit. Missing
or invalid evidence produces an unavailable result. Large trace files should not
be imported into the application bundle; summaries retain links to those artifacts.

See [scope and invariants](project-scope.md), [collection protocol](benchmark-protocol.md),
and [publication requirements](evidence-policy.md).

## Pending architecture decisions

The record schema and generator version 1 are implemented; see the
[generator contract](../README.md#shared-mock-data). Exact UI feature boundaries,
simulated update scheduling, benchmark instrumentation, and durable artifact
storage remain undecided. The `evidence/` directory is a proposal, not a
storage commitment. Choose a retained, reviewable location before publishing results.

## Market implementation boundaries

Baseline and optimized now have independent controllers and loaders under
`src/features/market/{baseline,optimized}/`, initially copied from reference for
behavioral equivalence. Neither delegates its lifecycle to the other or to the
reference controller. Changes to scheduling, fetching, indexing or cleanup in a
future experiment belong to that implementation's directory. Shared components,
query semantics and API schemas remain neutral. `src/app/LabFrame.tsx` supplies
common portfolio-inspired navigation; it does not own market data or state.
The parameterized parity suite uses seed 20260911 on desktop/mobile without making
performance claims.
