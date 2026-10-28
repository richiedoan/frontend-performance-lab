# Relative regression budgets (opt-in)

`yarn benchmark:budget candidate.json reference.json --metrics=search-duration --tolerance=0.02`
compares an optimized summary against baseline. For an approved optimized reference,
append `--approved-reference-sha256=<SHA-256 of the exact reference summary bytes>`.
The caller supplies a previously reviewed hash; the command does not approve a run
or authenticate who approved it. There is no shared CI gate or benchmark execution.
Output is JSON on stdout; inputs/evidence are read-only. Redirect to a new file if
needed, taking care not to overwrite previous evidence.

| Metric ID        | Unit  | Direction       | Required extraction definition                                                 |
| ---------------- | ----- | --------------- | ------------------------------------------------------------------------------ |
| initial-js-bytes | bytes | lower is better | initial-route JS boundary, raw/gzip/transfer convention, unique asset counting |
| long-task-count  | count | lower is better | browser long-task definition, observer/trace method, observation window        |
| dom-node-count   | count | lower is better | whole document or subtree, snapshot/readiness boundary, drawer state           |
| search-duration  | ms    | lower is better | input sequence, timing start/end, debounce and request inclusion               |

Without `--metrics`, all four are required. Select a subset explicitly when an
experiment only measures one metric; missing selected data never passes. No aliases
are inferred from `dom-nodes`, TBT, total transfer bytes, or drawer duration.

Tolerance is a relative fraction in [0, 1], default **0** (no permitted increase).
There are no absolute targets. Pass means `candidate <= reference * (1 + tolerance)`;
2% is only an example of an explicit operator choice, not a calibrated noise budget.
Choose it before reviewing results. The boundary is inclusive, with at most four
floating-point ULP-scale rounding units (not timing noise forgiveness). At reference
zero, only zero passes and percentage change is null. Improvement and equality pass;
regression is reported without calling the result statistically significant.

Overall precedence is `invalid` → `unavailable` → `regression` → `pass`; every metric
retains its individual outcome. Exit codes: 0 pass, 1 regression, 2 invalid/unavailable
or bad invocation. Missing files/results and failed/incomplete raw samples are
unavailable. Wrong hashes, unsafe/symlink paths, incorrect medians, invalid metadata,
units, extraction boundaries, duplicate iteration IDs or mismatched environments
are invalid. Neither state is silently converted to pass or zero.

## Verified summary input, version 1

This is a normalized review input, not a new collector or an automatic promotion
of existing Lighthouse/memory/bundle reports. No current result is synthesized to
populate these metrics. Existing summaries that lack the contract are rejected.
Tests create explicitly documented synthetic fixtures only in temporary directories.

A JSON summary has these required fields:

- `schemaVersion: 1`, `kind: "regression-budget-summary"`, `evidenceKind: "real"`.
- `approach: "optimized" | "baseline"`, nonempty `experiment`.
- `workload: {id, version, actionsSha256}`: nonempty IDs and a 64-character lowercase
  hex hash identifying the reviewed deterministic action script/definition.
- `environment: {path, sha256}` references a passing preflight `environment.json`.
  Its actual observations are validated using the existing environment validator.
- `metrics`: entries keyed by the IDs above. An absent key or
  `{status: "not-available", reason: "..."}` cannot pass.
- A measured entry contains `status: "measured"`, finite nonnegative `value`, `unit`,
  `aggregation: "median"`, `sampleCount: 5`, nonempty `extraction` identifying the
  versioned extraction boundary, and `evidence: {path, sha256}`.

Each referenced raw JSON contains `evidenceKind: "real"`, `metric`, `unit`,
`extraction`, `approach`, `experiment`, `workload`, `environmentSha256` (the exact
referenced environment file hash), and `samples`. Those identities must match the
summary. `samples` contains exactly five distinct iteration IDs 1–5, each with
`status: "passed"` and finite nonnegative `value`, or `status: "failed"` with a
nonempty `reason`. Byte/count samples must be safe integers. All five must pass;
the validator recomputes median and requires exact equality with the summary.
Paths are relative to the summary directory; traversal, absolute paths and symlink
components are rejected. Each file's SHA-256 is recomputed before parsing.

Environment compatibility compares Node/Yarn/Playwright, browser distribution,
version/revision/binary hash, OS/CPU/RAM, viewport/DPR, locale/timezone, applied CPU,
network/cache/service-worker policy, storage, dataset/checksum and iteration plan.
Experiment, workload and each metric's extraction definition must also match.
Source revision/dirty patch and executable location may differ between reviewed
revisions; source provenance must still validate in each preflight. Different
machines, cache states or workloads require separate evidence, not an override.

Hash verification plus median recomputation establishes internal evidence integrity,
not authenticity of measurements, extraction correctness, parity or human approval.
Review original collector artifacts and extraction methods before supplying a
normalized summary. The command neither invents observations nor certifies that
five samples establish significance. No real budget pass is claimed by this task.
