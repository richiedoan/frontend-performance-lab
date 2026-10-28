# Evidence policy

## Publication rule

Do not publish unsupported performance claims. Every measured value shown in the
case study, documentation, tables, or charts must link to its raw evidence. This
includes baseline values, optimized values, medians, and derived differences or
percentages. A summary or screenshot alone is not a substitute for the raw inputs
and a reproducible calculation.

No measurements are registered in the checked-in catalog. CI can import eligible
journey collections using the opt-in publication path described in [CI operations](ci.md#production-publication-opt-in). All performance results are
**unavailable** until the requirements here and in the
[benchmark protocol](benchmark-protocol.md) are satisfied. Do not use zero, example
numbers, estimates, or anticipated speedups as substitutes for missing results.
An unmeasured hypothesis must be explicitly labeled as such and must not appear
as a measured result.

## Required evidence package

Each published result must have a stable experiment ID and a retained manifest
containing:

- Hypothesis, one primary implementation variable, exact variant identities,
  supporting changes, and the parity checks required by the
  [project scope](project-scope.md).
- Reconstructable source and environment: revision, dirty patch if any, lockfile
  and build identity, collector versions, machine/browser conditions, and commands.
- Dataset identity: 5,000 records, seed 20260911, generator/schema versions,
  checksum, initial state, and deterministic update inputs.
- Scenario actions, measurement boundaries, warm-up/reset policy, metric
  definitions and units, and run ordering.
- All attempted run IDs with validity status, exclusion reasons, and retry history.
  Preserve excluded artifacts when available; record collection failures explicitly.
- Five valid runs per variant/scenario/condition set, each linked to its raw trace,
  profiler export, timing log, or other original collector output sufficient to
  reproduce the reported value. Record artifact checksums and collection timestamps.
- Extraction script or exact reproducible procedure, all per-run values, selected
  median, rounding rules, and any derived comparison formula.
- Interpretation, limitations, regressions, and the review outcome for evidence
  completeness and comparability.

The provenance chain must be navigable:
**displayed value → metric/run manifest → exact raw artifacts and extraction rule**.
Link raw artifacts directly where practical; a linked manifest must explicitly map
the displayed value to the relevant files and sample/event locations. A derived
comparison must expose evidence for both variants, not just the optimized one.

## Availability and integrity

| Evidence state                                     | Permitted presentation                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| No collection or fewer than five valid runs        | Unavailable, with the reason; attempted runs may be retained as incomplete evidence |
| Missing/corrupt artifacts or broken evidence links | Unavailable until repaired and verified                                             |
| Different conditions or failed parity              | Comparison unavailable; retain the diagnostic record without a speedup claim        |
| Complete, comparable, reviewed evidence            | Median of five valid runs with provenance and limitations                           |
| Superseded experiment or source revision           | Clearly labeled historical result tied to its original source and conditions        |

Do not silently overwrite published artifacts. Corrections require a versioned
manifest and an explanation; previous interpretations must remain traceable.
Verify checksums and links before publication. Local absolute paths, expiring
URLs, ignored build output, and temporary Playwright report directories are not
durable evidence destinations. Evidence must be accessible to the intended readers.
Screenshots may supplement raw artifacts but cannot replace them.

Storage, retention duration, and reviewer ownership must be decided before the
first publication. The [architecture](architecture.md) proposes a repository
`evidence/` location or a durable external artifact index; the CI journey publication path now uses a normalized public deployment snapshot
and requires a separate durable archive of original artifacts before CI expiration. Avoid secrets and personal data in recordings. Document any
redaction, retain metric-relevant data, and mark a result unavailable if redaction
prevents verification.

## Claims and metric naming

Scope every claim to the exact experiment, scenario, dataset, browser, machine,
and conditions. Describe an observed difference; do not generalize it to all users,
all devices, or the product as a whole. Keep hypotheses distinct from observations.
An isolated experiment changes one primary implementation variable; evidence from
multiple simultaneous changes cannot attribute a gain to one of them.

Use the collector's actual metric definition and units. Label controlled timings
as lab measurements. **Lab metrics must not be mislabeled as field INP.** No field
INP result is available from the current project. Any future field claim needs
separate field evidence and a defined collection protocol.

## Review before publication

Confirm parity, a reconstructable source, fixed conditions, five valid runs, correct
median extraction, working evidence links, and accurate metric labels. Reject
unsupported headlines even when underlying raw files exist: those files must
actually support the stated conclusion. Missing results remain unavailable, and
limitations stay visible beside the interpretation.

## Automated journey publication

Only the journey collector is supported by `scripts/benchmark/import-cli.ts`.
The importer validates the manifest, policy, environment, build/source provenance,
schedule and raw iterations, then recomputes each median from exactly five distinct
successful samples in one collection. A failed or missing attempt makes its approach
unavailable. A summary that contradicts raw evidence is an integrity failure and
blocks the whole publication; valid failed collections remain retained as failures.
No outlier removal, best-run selection, or joining across collections is permitted.
The UI keeps all runs separate and only derives differences inside one environment;
a zero baseline has no percentage comparison.

“Journey duration” (ms) includes Dashboard → Detail → Dashboard automation/network
waits. It is neither INP/LCP nor isolated algorithm time. Published `journey.json`
contains allowlisted raw timing samples and shared measurement conditions sufficient
to recompute medians; arbitrary error messages, full environment dumps, patches and
logs remain private. Publication retains checksums and blocks conflicting overwrites.
This validation does not prove scientific validity or replace parity/interpretation
review. Memory and Lighthouse require their own publication workflows.
