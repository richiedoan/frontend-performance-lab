import type { Scenario } from '../features/market/config/scenario-config';
import type { TranslationKey } from './useTranslation';

export const scenarioLabels = {
  default: 'defaultExplorer',
  'large-list': 'largeList',
  'search-input': 'searchResponsiveness',
  'worker-aggregation': 'workerAggregation',
  'render-boundary': 'renderBoundaries',
  'request-lifecycle': 'requestLifecycle',
  'bundle-loading': 'bundleLoading',
  'image-font-delivery': 'imageAndFontDelivery',
  'interval-memory-leak': 'intervalCleanup',
  'listener-memory-leak': 'listenerCleanup',
  'detached-dom-memory-leak': 'detachedDomCleanup',
} satisfies Record<Scenario, TranslationKey>;
