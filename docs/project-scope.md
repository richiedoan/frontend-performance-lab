# Project scope

## Product and current status

Frontend Performance Lab will present a generic **Live Market Explorer** for
comparing frontend implementations under controlled conditions. Market records
are synthetic; “live” means a reproducible simulation, not a connection to an
exchange or a claim about current prices.

The repository includes the deterministic generator/API, shared presentation,
reference explorer, isolated baseline/optimized scenarios, production collectors
and a case study backed by validated records. Diagnostic evidence exists, while
registered experiment measurements remain unavailable pending review/publication.
See the [setup instructions](../README.md) and [architecture](architecture.md).

## Routes

| Route         | Intended responsibility                                          |
| ------------- | ---------------------------------------------------------------- |
| `/baseline`   | Reference implementation of the explorer                         |
| `/optimized`  | Alternative implementation of the same explorer                  |
| `/case-study` | Experiment methodology, limitations, and evidence-backed results |

The `/` page links to these routes and `/reference`. Baseline and optimized
must preserve the same data, features and observable behavioral contract for the
same inputs. Route identity and measured execution time may differ; visible
content, accessibility, actions, and resulting state must not.

## Fixed decisions and experiment invariants

- Default dataset: **5,000 deterministic records using seed 20260911**. A seed
  alone is insufficient: both routes must use the same generator version, schema,
  record identities, ordering, and generated values.
- Both variants receive the same initial state, input sequence, and simulated
  updates. Any simulated clock and event schedule must be deterministic.
- Layout, styling, formatting, controls, keyboard behavior, accessibility semantics,
  and user-visible results must match. The eventual feature contract must specify
  loading, empty, and error states wherever applicable.
- Shared feature and parity tests must cover both variants. Dropping records,
  hiding features, reducing update fidelity, or changing output to improve a
  measurement violates parity.
- Each isolated experiment changes **one primary implementation variable**.
  Necessary supporting edits must be listed and cannot introduce another
  independent optimization. Combined changes require a separately labeled
  experiment and cannot establish individual causal effects.
- Measurements use fixed conditions and the **median of five valid runs**, as
  defined by the [benchmark protocol](benchmark-protocol.md).
- Every measured value must link to raw evidence. Unsupported claims must not be
  published; missing results remain **unavailable**. See the
  [evidence policy](evidence-policy.md).

## Non-goals

- Real market feeds, trading, payments, accounts, portfolios, or financial advice.
- Backend services, persistence, authentication, or production deployment work.
- A comprehensive market terminal, a UI redesign between variants, or a different
  feature set for the optimized route.
- Dashboard implementation, deliberate performance problems, or optimizations
  as part of the infrastructure and shared-data steps.
- Performance rankings across devices or browsers, universal speedup promises,
  and field performance conclusions based on lab measurements.
- Treating build success, smoke tests, synthetic numbers, or expectations as
  performance evidence.

## Decisions still required

The record schema and version 1 generator are defined in shared market data
(see the [generator contract](../README.md#shared-mock-data)). Before UI feature
implementation, define the feature and interaction contract and simulated update schedule. Before collecting
results, freeze the metric definitions, scenario scripts, environment settings,
instrumentation, and evidence retention location described in the benchmark and
evidence documents. No performance targets or results are established here.
