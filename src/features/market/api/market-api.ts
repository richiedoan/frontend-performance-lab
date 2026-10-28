import { parseMarketOptions } from '../config/market-options';
import { generateMarketRecords } from '../data/generate-market-records';
import type {
  MarketCategory,
  MarketRecord,
  MarketStatus,
} from '../data/market-record';

export interface MarketApiMeta {
  generatorVersion: number;
  seed: number;
  count: number;
  delayMs: number;
}

export interface MarketApiResponse<T> {
  data: T;
  meta: MarketApiMeta;
}

export interface MarketApiError {
  error: {
    code: 'INVALID_REQUEST' | 'NOT_FOUND' | 'SIMULATED_ERROR';
    message: string;
  };
}

export interface MarketSummary {
  totalRecords: number;
  totalVolume: number;
  averagePrice: number | null;
  averageChange: number | null;
  latestUpdatedAt: string | null;
  byCategory: Record<MarketCategory, number>;
  byStatus: Record<MarketStatus, number>;
}

function errorResponse(
  status: number,
  code: MarketApiError['error']['code'],
  message: string,
): Response {
  return Response.json({ error: { code, message } } satisfies MarketApiError, {
    status,
  });
}

/** Each request derives its data from the shared generator and its own options. */
export async function respondWithMarkets<T>(
  request: Request,
  select: (records: MarketRecord[]) => T | undefined,
): Promise<Response> {
  let options: ReturnType<typeof parseMarketOptions>;
  try {
    options = parseMarketOptions(request.url);
  } catch (error) {
    return errorResponse(
      400,
      'INVALID_REQUEST',
      error instanceof Error ? error.message : 'Invalid query parameters',
    );
  }
  const { simulateError, ...meta } = options;
  if (meta.delayMs > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, meta.delayMs));
  }
  if (simulateError) {
    return errorResponse(
      500,
      'SIMULATED_ERROR',
      'Simulated market API failure',
    );
  }
  const data = select(generateMarketRecords(meta));
  if (data === undefined) {
    return errorResponse(404, 'NOT_FOUND', 'Market record not found');
  }
  return Response.json({ data, meta } satisfies MarketApiResponse<T>);
}

export function summarizeMarkets(records: MarketRecord[]): MarketSummary {
  const summary: MarketSummary = {
    totalRecords: records.length,
    totalVolume: 0,
    averagePrice: null,
    averageChange: null,
    latestUpdatedAt: null,
    byCategory: {
      technology: 0,
      energy: 0,
      healthcare: 0,
      consumer: 0,
      industrial: 0,
    },
    byStatus: { active: 0, paused: 0, closed: 0 },
  };
  let priceCents = 0;
  let changeHundredths = 0;
  for (const record of records) {
    summary.totalVolume += record.volume;
    summary.byCategory[record.category] += 1;
    summary.byStatus[record.status] += 1;
    priceCents += Math.round(record.price * 100);
    changeHundredths += Math.round(record.change * 100);
    if (
      summary.latestUpdatedAt === null ||
      record.updatedAt > summary.latestUpdatedAt
    ) {
      summary.latestUpdatedAt = record.updatedAt;
    }
  }
  if (records.length > 0) {
    summary.averagePrice = Math.round(priceCents / records.length) / 100;
    summary.averageChange = Math.round(changeHundredths / records.length) / 100;
  }
  return summary;
}
