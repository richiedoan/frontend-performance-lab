import {
  DEFAULT_RECORD_COUNT,
  DEFAULT_SEED,
  MARKET_GENERATOR_VERSION,
} from '../data/generate-market-records';
import type { MarketApiMeta } from '../api/market-api';

const NUMBER_PATTERN = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function readNumber(
  params: URLSearchParams,
  key: string,
  fallback: number,
  min: number,
  max: number,
  integer: boolean,
): number {
  const raw = params.get(key);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (
    !NUMBER_PATTERN.test(raw) ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    throw new Error(
      `${key} must be ${integer ? 'an integer' : 'a finite number'} between ${min} and ${max}`,
    );
  }
  return value;
}

export function parseMarketOptions(
  url: string,
): MarketApiMeta & { simulateError: boolean } {
  const params = new URL(url).searchParams;
  for (const key of params.keys()) {
    if (!['seed', 'count', 'delayMs', 'simulateError'].includes(key)) {
      throw new Error(`Unknown parameter: ${key}`);
    }
    if (params.getAll(key).length !== 1) {
      throw new Error(`Duplicate parameter: ${key}`);
    }
  }
  const simulateError = params.get('simulateError');
  if (
    simulateError !== null &&
    simulateError !== 'true' &&
    simulateError !== 'false'
  ) {
    throw new Error('simulateError must be true or false');
  }
  return {
    generatorVersion: MARKET_GENERATOR_VERSION,
    seed: readNumber(
      params,
      'seed',
      DEFAULT_SEED,
      -Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      false,
    ),
    count: readNumber(params, 'count', DEFAULT_RECORD_COUNT, 0, 10_000, true),
    delayMs: readNumber(params, 'delayMs', 0, 0, 5_000, true),
    simulateError: simulateError === 'true',
  };
}
