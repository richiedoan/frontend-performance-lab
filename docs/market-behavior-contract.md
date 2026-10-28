# Shared market behavior contract

This is the target observable contract for `/baseline` and `/optimized`, version 1.
Both comparison routes and `/reference` now exercise this contract. This step supplies semantic reference functions,
controlled presentation hooks, and reusable journeys; it does not claim completed
route parity or measured performance. Existing API paths/schemas remain unchanged.

## Inputs and ordering

Both variants use the same generator version, seed and count (defaults 20260911 and
5,000). Dashboard URL parameters `seed`, `count`, `delayMs` use the API's documented
bounds/defaults and must be forwarded consistently to collection, detail and summary.
Invalid configuration must show an error, never silently select another dataset.

Initial controls: empty search, category/status `all`, name ascending. Search is a
literal substring of `name` only, after trimming the query and lowercasing both
strings with JavaScript `toLowerCase`. Internal whitespace is preserved; no regex,
accent folding, locale-specific collation, or token rearrangement is performed.
Empty/whitespace search matches every name. Category and status match exact enum
values; `all` disables only its own filter. Search and both filters combine with AND.

Filter before sorting. Price and volume compare numerically; supported presentation
sorts also include numeric change and lowercase name in UTF-16 code-unit order.
Clicking a different sort key starts ascending; clicking the active key toggles.
Every primary tie uses exact ID ascending, even in descending order. Thus input
array order and locale do not change output ordering. Do not mutate input records.
`aria-sort` reports the active direction; zero matches shows the empty state.
Summary cards describe the entire configured dataset, independently of filters.

`src/features/market/domain/market-query.ts` defines these pure semantics. It may be
used as a reference oracle or reused where appropriate. Sharing scheduling,
normalization caches, indexing, request lifecycle, memoization, render strategy or
worker orchestration would confound future experiments and is not prescribed.
Variants may use different algorithms but must produce the same eventual values and
ordering for the same final inputs. No fixed debounce delay or request count is
part of this contract.

## Expansion and details

Each record has a native expand button with its record name, `aria-expanded`, and
`aria-controls`. Expansion reveals the record ID and UTC updated time immediately
after that row. Multiple rows may be expanded; toggling one does not affect another.
Controllers store expanded IDs, never positional indexes. Sorting keeps expansion;
search/filter changes discard expansion for records no longer visible. Clearing a
filter does not reopen a discarded expansion. Refresh collapses all expansions.
The shared table exposes optional `expansion` props for incremental adoption; both
completed dashboards must supply them.

View details opens the selected record in the modal drawer, using that same seed
and count. Expansion and selection are independent. The drawer identifies the
record and displays category, status, price, change, volume, updated time and chart
history. Opening focuses Close. Escape and Close dismiss, preserve controls and
row expansion, and restore focus to the opener. If the opener no longer exists,
controllers focus the search input. Search/filter changes that remove the selected
record close its drawer; sorting preserves selection. If detail loading is async,
show loading first, expose failure with Retry, and never show a previous record as
the newly selected one. Parent controllers own these lifecycle states; the current
`DetailDrawer` handles only a supplied record/null and dismissal callbacks.

## Refresh and asynchronous states

Refresh reloads the same dataset configuration without incrementing the seed,
changing count, modifying prices locally, or resetting search/filter/sort. It
closes detail and collapses expansions, enters loading, disables Refresh, and hides
old rows/summary until the new result is ready. Repeated activation while loading
has no effect. With unchanged generator inputs, refresh returns identical records
and summary. A completed refresh reapplies the latest controls.

Initial load, refresh and retry use mutually exclusive loading/error/success
states. Loading has `role=status`; success with zero visible rows has an explicit
`role=status` empty view. Failure has `role=alert`, a useful message and a native
Retry button; it is never represented as an empty result. Retry enters loading,
uses the same configuration and retains controls. A request-local simulated error
must not become a persistent failure flag. Async completion must not replace the
current configuration with an older one; the reference uses AbortController cleanup for correctness; comparative cancellation experiments remain deferred.

## Keyboard and selectors

Tab follows DOM order: search, category, status, Refresh, scrollable table, sort
buttons, then each row's Expand and View details. Inputs/selects retain native
keyboard behavior. Buttons activate with Enter/Space and show visible focus.
Modal dialog focus remains inside the drawer until dismissal. The table's scroll
region is keyboard-focusable, with headers and row relationships preserved.

`MARKET_SELECTORS` in `components/market-selectors.ts` is the shared `data-testid`
contract. Rows use `market-row` plus `data-market-id`; ID-based actions use
`market-expand-<id>`, `market-expanded-<id>` and `market-detail-<id>`. Other hooks
identify controls, sort keys, summary, table, loading/empty/error/Retry and drawer.
Selectors supplement accessible labels; they do not replace semantics or depend
on localized record names, DOM positions, styles or implementation variant.

`e2e/helpers/market-journey.ts` provides parameterized navigation, search/filter/sort,
ordered row assertions, keyboard expansion/detail dismissal, refresh/retry and
exclusive-state assertions. `failNextCollection` installs a one-request failure
before navigation/refresh to test recovery without permanent URL failure flags.
Use small deterministic fixtures for DOM row-order assertions; these helpers do
not prescribe full-dataset DOM counts for later virtualization experiments.
Use a held intercepted response or a configured API delay when asserting loading;
assert eventual rows after control changes, without arbitrary sleeps.

A future parity suite must run the same journey against both variants: initial
success → search/filter/sort → expand/collapse → detail/keyboard dismissal →
refresh with retained controls → empty → failed load → Retry recovery. Journey
helpers execute against all three dashboards; `e2e/parity.spec.ts` checks both comparison routes.
Pure function and component tests validate the semantics and hooks implemented now.

## Scenario selection

Baseline/optimized validate scenario and dataset parameters before mounting their
controller. See README's scenario configuration for supported values and bounds.
Invalid parameters render a configuration error and Reset configuration action;
no request is issued. Scenario is never forwarded to the mock API. All scenario
choices currently preserve the same behavior; experiment workloads are deferred.
A development-only indicator reports the selected scenario and dataset.
