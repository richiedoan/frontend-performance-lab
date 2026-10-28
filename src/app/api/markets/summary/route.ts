import {
  respondWithMarkets,
  summarizeMarkets,
} from '../../../../features/market/api/market-api';

export function GET(request: Request): Promise<Response> {
  return respondWithMarkets(request, summarizeMarkets);
}
