export const en = {
  footerAiAssistance: 'Built with AI assistance.',
  largeDatasetChallengeTitle: 'Rendering large datasets.',
  largeDatasetChallengeBody:
    'With 5,000 records, rendering the full table caused severe lag. Virtualization also had to preserve row expansion, scrolling, keyboard navigation and focus restoration.',
  timeoutChallengeTitle: 'Diagnosing timeouts instead of extending deadlines.',
  timeoutChallengeBody:
    'Failures occurred during data loading, table rendering and interaction. Raising timeouts made jobs run longer without resolving the bottleneck.',
  layerizeChallengeTitle: 'Investigating browser rendering stalls.',
  layerizeChallengeBody:
    'Local diagnostics recorded roughly 87 seconds in Chrome Layerize before the click reached the application. Removing radius, changing border collapse, disabling transitions and removing shadow individually did not establish the root cause. Docker/CI reproduction remains unverified.',
  e2eChallengeTitle: 'Keeping end-to-end tests reliable in CI.',
  e2eChallengeBody:
    'Runner speed, large datasets and ambiguous selectors could cause failures. Tests needed to observe real application states without reducing workloads or removing assertions just to pass.',
  environmentChallengeTitle: 'Making execution environments reproducible.',
  environmentChallengeBody:
    'Node and Yarn versions differed, a CI image lacked Git, and a benchmark job had no runner matching its tag. Running on Mac or Docker did not automatically reproduce CI conditions.',
  publicationChallengeTitle: 'Getting validated results into the deployed app.',
  publicationChallengeBody:
    'GitLab artifacts do not automatically appear on Vercel. Results need an import and publication workflow, validation and a data source included in the deployment. A missing published-runs.json file also caused typechecking to fail.',
  aiCollaborationChallengeTitle: 'Working with AI while controlling scope.',
  aiCollaborationChallengeBody:
    'AI interpretations needed review, existing changes needed protection, and implementations needed tests. Confirmed findings had to remain separate from hypotheses. Enabling every scenario initially added demo workloads and diagnostics, requiring a correction after reviewing the actual UI.',

  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  expandedSnapshot: 'Snapshot for {name}',
  snapshotLabel: 'Record snapshot',
  snapshotPrice: 'Latest price',
  snapshotChange: 'History change',
  snapshotRange: 'History low – high',
  snapshotVolume: 'Traded units',
  snapshotNoHistory: 'No history available',
  snapshotUpdated: 'Last updated',
  snapshotContext:
    'Synthetic lab data · {count} history points. Change compares the first and last price; the range covers the available history, not a fixed trading day.',

  optimizedExplorer: 'Optimized Explorer',
  combinedOptimizationsHelp:
    'Keeps the default explorer interface with virtualized lists, debounced search and on-demand charts. Requests and search work are cancelled on cleanup. Experiment panels and extra demo workloads are available only in individual scenarios.',
  combinedDefaultsExplanation:
    'With no scenario parameter or the legacy scenario=default URL, /optimized opens Optimized Explorer with optimizations for the standard explorer interactions; /baseline still uses the default scenario. Use the individual scenario pairs below to compare one optimization at a time.',
  combinedOptimizationsAction:
    'Search, filter, sort and scroll, expand a row, then open and close a record.',

  aboutTheProject: 'About the project',
  frontendPerformanceLab: 'Frontend Performance Lab',
  aHandsonProjectForUnderstandingHowFrontend:
    'A hands-on project for understanding how frontend implementation choices affect responsiveness, rendering, loading, and memory.',
  whatThisProjectIsDesignedToDo: 'What this project is designed to do',
  theLabUsesALiveMarketExplorer:
    'The lab uses a Live Market Explorer built with Next.js, React, and TypeScript to compare baseline and optimized implementations of the same user experience. Deterministic mock data makes scenarios repeatable, while isolated experiments help connect a performance problem to a specific implementation choice.',
  exploreLargeListsSearchResponsivenessWorkerAggregation:
    'Explore large lists, search responsiveness, worker aggregation, render boundaries, request lifecycles, asset delivery, and memory cleanup. The goal is to practice diagnosing bottlenecks, checking trade-offs, and supporting conclusions with evidence.',
  referenceBaselineAndOptimized: 'Reference, Baseline, and Optimized',
  theThreeExplorersServeDifferentPurposesStart:
    'The three explorers serve different purposes. Start with Reference to learn the shared behavior, then compare Baseline and Optimized using one of the scenario pairs below.',
  referenceLearnTheExpectedBehavior: 'Reference: learn the expected behavior',
  useThisAsAFunctionalReferenceFor:
    'Use this as a functional reference for searching, filtering, sorting, and opening record details. It helps you understand what the explorer should do and check that implementation changes preserve the expected results. It is not a speed benchmark or a promise of the fastest implementation.',
  trySearchingForMarket1SortingBy:
    'Try searching for Market 1, sorting by price, and opening a record. This starter link uses 60 records with seed 20260911.',
  openReferenceExplorer: 'Open Reference Explorer',
  baselineInspectTheComparisonStartingPoint:
    'Baseline: inspect the comparison starting point',
  thisIsTheControlImplementationForThe:
    'This is the control implementation for the selected experiment. Some scenarios intentionally include inefficient work or retained resources so you can investigate a specific problem. For example, large-list renders every matching record, including those outside the viewport.',
  optimizedExploreATargetedChange: 'Optimized: explore a targeted change',
  thisImplementsTheApproachBeingTestedFor:
    'This implements the approach being tested for the selected scenario, such as virtualization for large-list or cleanup for a memory experiment. It aims to preserve the shared functional results while changing how the work is done. The name alone does not prove a speedup or reduced memory use.',
  buildingTheProject: 'Building the project',
  builtIn3DaysWithAiSupport: 'Built in 3 days with AI support.',
  theBuildBroughtTogetherAnInteractiveDemo:
    'The build brought together an interactive demo, controlled experiments, automated checks, and evidence reporting. The main engineering challenges were:',
  keepingComparisonsFair: 'Keeping comparisons fair.',
  bothImplementationsNeedTheSameDataAnd:
    'Baseline and Optimized had to use the same data, filters, sorting, search and detail drawer behavior, including loading, empty, error and retry states, for meaningful comparisons.',
  isolatingEachBottleneck: 'Isolating each bottleneck.',
  listRenderingSearchWorkersRequestsAndMemory:
    'List rendering, search, workers, requests, and memory experiments need separate scenarios so that unrelated work does not obscure the effect being investigated.',
  gettingLifecycleCleanupRight: 'Getting lifecycle cleanup right.',
  requestsTimersListenersAndRetainedDomReferences:
    'Obsolete searches and requests had to be cancelled, workers terminated at the right time, and timers, listeners and DOM references released when switching scenarios or leaving a route.',
  turningObservationsIntoCredibleEvidence:
    'Turning observations into credible evidence.',
  reproducibleRunsValidationAndTraceableArtifactsMatter:
    'Measurements needed existing evidence, valid run records and enough iterations to calculate a median. Timeouts and missing data could not be presented as successful measurements.',
  howToUseTheLab: 'How to use the lab',
  chooseOneScenarioBelowAndReadIts:
    'Choose one scenario below and read its suggested interaction.',
  openBothVersionsUsingItsOpenBaseline:
    'Open both versions using its Open baseline and Open optimized links.',
  keepTheSameScenarioSeedCountAnd:
    'Keep the same scenario, seed, count, and any scenario-specific parameters. Repeat the same actions in the same order in both versions.',
  separateHowInteractionFeelsFromValidatedMeasurements:
    'Separate how interaction feels from validated measurements. Visit the',
  caseStudy: 'Case Study',
  forEvidenceUnavailableMeansThereIsNo:
    'for evidence. Unavailable means there is no result qualified for publication yet; it does not establish a speedup or memory improvement.',
  theseLinksAreInteractiveDemosWithModest:
    'These links are interactive demos with modest workloads, not benchmark profiles. Local diagnostics and perceived responsiveness are not validated performance results. Use the same environment for both versions; for memory scenarios, start each version in a fresh tab and repeat the same navigation cycles. Cleanup signals alone do not prove reduced memory use.',
  try: 'Try:',
  full5000recordWorkload: 'Full 5,000-record workload',
  forALocalOrDedicatedEnvironmentWith:
    'For a local or dedicated environment with sufficient response capacity. Interactions may be slow. The current collection payload exceeds Vercel Functions’ response size limit, so this full workload is not suitable for that hosting setup.',
  defaultExplorer: 'Default explorer',
  sharedExplorerBehaviorWithoutASelectedOptimization:
    'Shared explorer behavior without a selected optimization experiment.',
  searchForMarket1ChangeACategory:
    'Search for Market 1, change a category filter, sort by price, then open and close a record.',
  largeList: 'Large list',
  fulllistRenderingVersusVirtualization:
    'Full-list rendering versus virtualization.',
  scrollThroughTheListSortByPrice:
    'Scroll through the list, sort by price, then expand a row and open its details.',
  searchResponsiveness: 'Search responsiveness',
  repeatedSearchWorkDebouncingAndCancellationOf:
    'Repeated search work, debouncing, and cancellation of superseded searches.',
  quicklyTypeMarket1ClearItThen:
    'Quickly type Market 1, clear it, then type Market 2. Open search diagnostics to inspect requests.',
  workerAggregation: 'Worker aggregation',
  aggregationOnTheMainThreadVersusA:
    'Aggregation on the main thread versus a Web Worker.',
  changeTheAggregationPassesFrom20To:
    'Change the aggregation passes from 20 to 40, then type in search while aggregation updates.',
  renderBoundaries: 'Render boundaries',
  unrelatedNoteEditsCausingSummaryRenders:
    'Unrelated note edits causing summary renders.',
  typeANoteAndToggleTheSummary:
    'Type a note and toggle the summary explanation. In development, compare the change in summary render commits.',
  requestLifecycle: 'Request lifecycle',
  duplicateRequestsStaleResponsesAndCacheReuse:
    'Duplicate requests, stale responses, and cache reuse.',
  selectRunRequestRaceWatchTheDiagnostics:
    'Select Run request race, watch the diagnostics until completion, then run it again to inspect cache reuse.',
  bundleLoading: 'Bundle loading',
  eagerVersusOndemandLoadingOfDrawerChart:
    'Eager versus on-demand loading of drawer chart code.',
  openARecordToLoadItsChart:
    'Open a record to load its chart, close it, then reopen it. Use the Network panel to inspect JavaScript requests.',
  imageAndFontDelivery: 'Image and font delivery',
  imageSizingLoadingPriorityAndFontDelivery:
    'Image sizing, loading priority, and font delivery.',
  reloadEachVersionWithTheSameNetwork:
    'Reload each version with the same network settings, then scroll through the illustrations and watch their loading and layout.',
  intervalCleanup: 'Interval cleanup',
  timersRetainingRecordSnapshotsAfterUnmount:
    'Timers retaining record snapshots after unmount.',
  waitForAnAutorefreshTickNavigateTo:
    'Wait for an auto-refresh tick, navigate to Overview and return with Back. Repeat twice within 20 seconds.',
  listenerCleanup: 'Listener cleanup',
  windowListenersRetainingRecordsAfterUnmount:
    'Window listeners retaining records after unmount.',
  runTheListenerProbeNavigateToOverview:
    'Run the listener probe, navigate to Overview and return with Back twice, then probe again and reset experiment listeners.',
  detachedDomCleanup: 'Detached DOM cleanup',
  closedDrawerChartNodesRetainedInA:
    'Closed drawer chart nodes retained in a cache.',
  openARecordWaitForItsChart:
    'Open a record, wait for its chart, then close it. Repeat three times and select Reset retained references.',
  defaultsExplanation:
    'Without query parameters, /baseline and /optimized use the default scenario. Optimized only enables the implementation for the selected scenario; it does not enable every optimization at once. For example, large-list enables virtualization, while memory scenarios focus on cleanup and retention and can still lag when rendering the full list.',
  parameterDefinitions:
    'scenario = experiment to run; seed = reproducible dataset; count = number of records.',
  language: 'Language',
  scenarioDemos: 'Scenario demos',
  demoDataset: 'Demo: {count} records · seed 20260911',
  openBaseline: 'Open baseline',
  openOptimized: 'Open optimized',
  openScenario: '{action}: {name}',
  openFullScenario: '{action}: {name} — {workload}',
} as const;
