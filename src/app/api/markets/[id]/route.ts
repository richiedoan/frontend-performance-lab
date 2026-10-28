import { respondWithMarkets } from '../../../../features/market/api/market-api';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return respondWithMarkets(request, (records) =>
    records.find((record) => record.id === id),
  );
}
