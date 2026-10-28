import { MARKET_CATEGORIES, MARKET_STATUSES } from './market-record.ts';
import type { MarketRecord } from './market-record.ts';

export const DEFAULT_RECORD_COUNT = 5_000;
export const DEFAULT_SEED = 20260911;
export const MARKET_GENERATOR_VERSION = 1;

export interface GenerateMarketRecordsOptions {
  count?: number;
  seed?: number;
}

const REFERENCE_TIME = Date.parse('2026-09-11T12:00:00.000Z');
const HOUR_MS = 3_600_000;

// Hash the canonical numeric seed, including fractional and negative seeds,
// into a local 32-bit state. The LCG returns values in [0, 1).
function createSeededRandom(seed: number): () => number {
  let state = 2166136261;
  for (const character of String(seed)) {
    state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Pure synthetic fixtures; no clock, network, React, or shared mutable state. */
export function generateMarketRecords({
  count = DEFAULT_RECORD_COUNT,
  seed = DEFAULT_SEED,
}: GenerateMarketRecordsOptions = {}): MarketRecord[] {
  if (!Number.isInteger(count) || count < 0 || count > 4294967295) {
    throw new RangeError('count must be an integer between 0 and 4294967295');
  }
  if (!Number.isFinite(seed)) {
    throw new RangeError('seed must be a finite number');
  }

  const random = createSeededRandom(seed);
  const integer = (min: number, max: number) =>
    min + Math.floor(random() * (max - min + 1));

  return Array.from({ length: count }, (_, index) => {
    const id = `market-${String(index + 1).padStart(6, '0')}`;
    const category =
      MARKET_CATEGORIES[integer(0, MARKET_CATEGORIES.length - 1)];
    const status = MARKET_STATUSES[integer(0, MARKET_STATUSES.length - 1)];
    const name = `${category[0].toUpperCase()}${category.slice(1)} Market ${index + 1}`;
    const priceCents = integer(1_000, 1_000_000);
    const volume = integer(0, 10_000_000);
    const updatedTime = REFERENCE_TIME - integer(0, 86_399) * 1_000;
    const chartHistory = Array.from({ length: 24 }, (_, pointIndex) => ({
      timestamp: new Date(
        updatedTime - (23 - pointIndex) * HOUR_MS,
      ).toISOString(),
      price:
        pointIndex === 23
          ? priceCents / 100
          : Math.min(
              1_000_000,
              Math.max(
                1_000,
                Math.round((priceCents * integer(900, 1_100)) / 1_000),
              ),
            ) / 100,
    }));
    const price = priceCents / 100;
    const change =
      Math.round((price / chartHistory[0].price - 1) * 10_000) / 100;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#e2e8f0"/><text x="32" y="40" text-anchor="middle" font-size="24" fill="#0f172a">${category[0].toUpperCase()}</text></svg>`;

    return {
      id,
      name,
      category,
      status,
      price,
      change,
      volume,
      updatedAt: new Date(updatedTime).toISOString(),
      image: {
        src: `data:image/svg+xml,${encodeURIComponent(svg)}`,
        alt: `${name} icon`,
        width: 64,
        height: 64,
      },
      chartHistory,
    };
  });
}
