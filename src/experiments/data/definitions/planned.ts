import type { ExperimentDefinition } from '../types/experiment';

export const plannedDefinitions: ExperimentDefinition[] = [
  {
    id: 'large-list',
    title: 'Large list',
    hypothesis:
      'Changing rendering window may affect dom-nodes; unmeasured hypothesis.',
    primaryVariable: 'Rendering window',
    approaches: [
      { id: 'baseline', description: 'Full list rendering (planned)' },
      { id: 'optimized', description: 'Windowed rendering (planned)' },
    ],
    metrics: [{ id: 'dom-nodes', unit: 'count' }],
  },
  {
    id: 'search-input',
    title: 'Search input',
    hypothesis:
      'Changing input scheduling may affect search-duration; unmeasured hypothesis.',
    primaryVariable: 'Input scheduling',
    approaches: [
      { id: 'baseline', description: 'Process each input (planned)' },
      {
        id: 'optimized',
        description: 'Debounce and discard obsolete input work (planned)',
      },
    ],
    metrics: [{ id: 'search-duration', unit: 'ms' }],
  },
  {
    id: 'worker-aggregation',
    title: 'Worker aggregation',
    hypothesis:
      'Changing aggregation execution context may affect aggregation-duration; unmeasured hypothesis.',
    primaryVariable: 'Aggregation execution context',
    approaches: [
      { id: 'baseline', description: 'Main-thread aggregation (planned)' },
      { id: 'optimized', description: 'Worker aggregation (planned)' },
    ],
    metrics: [{ id: 'aggregation-duration', unit: 'ms' }],
  },
  {
    id: 'render-boundary',
    title: 'Render boundaries',
    hypothesis:
      'Changing state and prop boundaries may affect render-count; unmeasured hypothesis.',
    primaryVariable: 'State and prop boundaries',
    approaches: [
      { id: 'baseline', description: 'Broad state updates (planned)' },
      {
        id: 'optimized',
        description: 'Local state and stable props (planned)',
      },
    ],
    metrics: [{ id: 'render-count', unit: 'count' }],
  },
  {
    id: 'request-lifecycle',
    title: 'Request lifecycle',
    hypothesis:
      'Changing request lifecycle policy may affect request-count; unmeasured hypothesis.',
    primaryVariable: 'Request lifecycle policy',
    approaches: [
      { id: 'baseline', description: 'Uncoordinated requests (planned)' },
      {
        id: 'optimized',
        description: 'Bounded request coordination (planned)',
      },
    ],
    metrics: [{ id: 'request-count', unit: 'count' }],
  },
  {
    id: 'bundle-loading',
    title: 'Bundle loading',
    hypothesis:
      'Changing chart loading strategy may affect initial-javascript; unmeasured hypothesis.',
    primaryVariable: 'Chart loading strategy',
    approaches: [
      { id: 'baseline', description: 'Eager chart code (planned)' },
      { id: 'optimized', description: 'On-demand chart code (planned)' },
    ],
    metrics: [{ id: 'initial-javascript', unit: 'bytes' }],
  },
  {
    id: 'image-font',
    title: 'Image and font delivery',
    hypothesis:
      'Changing asset delivery strategy may affect layout-shift; unmeasured hypothesis.',
    primaryVariable: 'Asset delivery strategy',
    approaches: [
      { id: 'baseline', description: 'Eager unreserved assets (planned)' },
      {
        id: 'optimized',
        description: 'Sized responsive assets and stable fonts (planned)',
      },
    ],
    metrics: [{ id: 'layout-shift', unit: 'score' }],
  },
  {
    id: 'interval-memory-leak',
    title: 'Interval cleanup',
    hypothesis:
      'Changing interval ownership may affect retained-heap; unmeasured hypothesis.',
    primaryVariable: 'Interval ownership',
    approaches: [
      { id: 'baseline', description: 'Retained interval (planned)' },
      { id: 'optimized', description: 'Interval cleanup (planned)' },
    ],
    metrics: [{ id: 'retained-heap', unit: 'bytes' }],
  },
  {
    id: 'listener-memory-leak',
    title: 'Listener cleanup',
    hypothesis:
      'Changing listener ownership may affect retained-heap; unmeasured hypothesis.',
    primaryVariable: 'Listener ownership',
    approaches: [
      { id: 'baseline', description: 'Retained listener (planned)' },
      { id: 'optimized', description: 'Listener cleanup (planned)' },
    ],
    metrics: [{ id: 'retained-heap', unit: 'bytes' }],
  },
  {
    id: 'detached-dom-memory-leak',
    title: 'Detached DOM',
    hypothesis:
      'Changing dom reference ownership may affect detached-nodes; unmeasured hypothesis.',
    primaryVariable: 'DOM reference ownership',
    approaches: [
      { id: 'baseline', description: 'Retained detached nodes (planned)' },
      { id: 'optimized', description: 'Released DOM references (planned)' },
    ],
    metrics: [{ id: 'detached-nodes', unit: 'count' }],
  },
];
