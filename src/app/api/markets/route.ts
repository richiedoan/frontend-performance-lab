import { respondWithMarkets } from '../../../features/market/api/market-api';

export function GET(request: Request): Promise<Response> {
  return respondWithMarkets(request, (records) => records);
}
