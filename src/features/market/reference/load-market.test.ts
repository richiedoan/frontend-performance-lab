import { afterEach, expect, it, vi } from 'vitest';
import { loadMarket } from './load-market';

afterEach(() => vi.unstubAllGlobals());
it('loads both resources with identical query and AbortSignal', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ data: [] }))
    .mockResolvedValueOnce(Response.json({ data: { totalRecords: 0 } }));
  vi.stubGlobal('fetch', fetch);
  const controller = new AbortController();
  expect(await loadMarket('count=0&seed=42', controller.signal)).toEqual({
    records: [],
    summary: { totalRecords: 0 },
  });
  expect(fetch).toHaveBeenNthCalledWith(1, '/api/markets?count=0&seed=42', {
    signal: controller.signal,
  });
  expect(fetch).toHaveBeenNthCalledWith(
    2,
    '/api/markets/summary?count=0&seed=42',
    { signal: controller.signal },
  );
});
it('rejects HTTP failure and never fetches an already aborted request', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
  vi.stubGlobal('fetch', fetch);
  const controller = new AbortController();
  await expect(loadMarket('', controller.signal)).rejects.toThrow('HTTP 500');
  fetch.mockClear();
  controller.abort();
  await expect(loadMarket('', controller.signal)).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(fetch).not.toHaveBeenCalled();
});
