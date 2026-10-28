export const MARKET_CATEGORIES = [
  'technology',
  'energy',
  'healthcare',
  'consumer',
  'industrial',
] as const;
export const MARKET_STATUSES = ['active', 'paused', 'closed'] as const;

export type MarketCategory = (typeof MARKET_CATEGORIES)[number];
export type MarketStatus = (typeof MARKET_STATUSES)[number];

export interface MarketImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface MarketHistoryPoint {
  /** ISO 8601 UTC timestamp. */
  timestamp: string;
  /** Synthetic USD price, rounded to cents. */
  price: number;
}

export interface MarketRecord {
  id: string;
  name: string;
  category: MarketCategory;
  status: MarketStatus;
  /** Synthetic USD price, rounded to cents. */
  price: number;
  /** Percentage change from the first to the last chart point. */
  change: number;
  /** Synthetic traded units. */
  volume: number;
  /** ISO 8601 UTC timestamp, matching the last chart point. */
  updatedAt: string;
  image: MarketImage;
  chartHistory: MarketHistoryPoint[];
}
