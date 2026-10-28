# AI-assistance investigation log

Copy [the blank JSON template](templates/ai-investigation.json) to a new record file.
It is a draft, not an investigation or a claim. The registry in
`src/experiments/data/catalog/investigations.ts` is deliberately empty. Do not add
templates, synthetic fixtures or automatically generated narratives to it.

## Workflow

1. **Record trace**: capture an actual trace/profile with route, scenario, dataset,
   environment and run identity; retain the original artifact.
2. **Find bottleneck**: identify a concrete interval/event/retainer and its limits.
3. **Ask AI**: record the question and AI hypothesis verbatim or as a clearly labeled
   faithful summary. A hypothesis is not evidence.
4. **Check evidence/source**: inspect the trace and the referenced source at a pinned
   revision. Record findings including contradictions; do not accept a plausible
   explanation without checking it.
5. **Change one variable**: keep a related diff. A rejected suggestion can have no
   change; explicitly explain why its diff is unavailable.
6. **Measure again under the same conditions**: link before/after evidence and note
   environment/seed/count/cache/workload compatibility. Missing measurements require
   reasons and cannot support a speedup claim. An evidence-based rejection need not
   implement an unsafe or disproven suggestion merely to obtain an after measurement.
7. **Accept/reject**: write the decision summary, reasoning, reviewer and review date.
   Validate before adding an actual record to the registry. Revalidate published
   evidence after changes; never overwrite the original trace or diff.

## Record contract

`schemaVersion` is 1. `id` and `experimentId` are lowercase hyphenated identifiers.
`status` is `draft` or `verified`; `decision` is `pending`, `accepted` or `rejected`.
The record includes `question`, `aiHypothesis`, `decisionSummary` and `reasoning`.
Draft text may be blank. Verified text must be nonempty and the decision final.

`evidenceInspected` contains `{artifact, finding}` entries. `artifact` uses the
existing `{path, kind, sha256, collectedAt}` contract: kind is trace/profile/log/
screenshot; dates use canonical ISO UTC; SHA-256 is lowercase hex. Paths must start
with `evidence/`, be safe relative paths and resolve to nonempty regular files without
symlink components. Each file's checksum is checked, including diff and measurement
references. The finding explains what was actually inspected in that artifact.

`sourceLocations` contains `{path, startLine, endLine, revision}`. Line numbers are
positive integers, end >= start. Use a commit SHA for `revision` and inspect that
revision, not just the current editor contents. The validator checks location syntax;
it does not fetch old revisions or prove that the source supports the hypothesis.

`relatedDiff`, `measurements.before` and `measurements.after` each hold an artifact or
`{status: "not-available", reason: "..."}`. `measurements.conditions` is explanatory
text, or unavailable with a reason when no measurement is linked. Any linked
measurement requires condition notes. Neither unavailable references nor matching
hashes imply measured improvement. `verification` is null for an unreviewed draft,
or `{reviewer, verifiedAt}`; it is mandatory for verified records.

## Validation and publication

`yarn investigation:validate record.json [evidence-public-root]` is read-only.
Default root is `public`; referenced paths are relative to that root. Exit 0 means
structurally valid (drafts explicitly report `publishable: false`); exit 1 means
invalid. It never marks a draft verified automatically. A verified record requires
at least one inspected artifact with a finding, at least one source location,
a final decision, reasoning, reviewer/date and verified bytes for every supplied
artifact. Empty, missing, changed or unsafe evidence prevents verification.

Only reviewed records intentionally registered and with evidence published under
`public/evidence/` appear in `/case-study`. The server revalidates each record and
all referenced files before returning accepted/rejected suggestions. Draft, pending
and invalid records are omitted; use the CLI to see rejection reasons. The UI has
an explicit empty state. Publishing evidence is a deliberate action: review source,
trace, prompt and diff content before putting them in the public directory.

Verification here means validated metadata and evidence integrity plus an attributed
human review. It does not authenticate the reviewer, independently verify the AI
hypothesis, or certify causality, comparable measurements or statistical significance.
No actual investigations or performance claims are created by this change.
