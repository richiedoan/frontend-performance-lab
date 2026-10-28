import { expect, it } from 'vitest';
import { describeAsset, summarizeAssets } from './sizes';
it('derives bytes/hash/compression from actual bytes and counts each URL once', () => {
  const asset = describeAsset(
    'http://localhost/_next/static/chunks/test.js',
    Buffer.from('hello'),
  );
  expect(asset.bytes).toBe(5);
  expect(asset.sha256).toHaveLength(64);
  expect(asset.gzipBytes).toBeGreaterThan(0);
  expect(summarizeAssets([asset, asset]).bytes).toBe(5);
  expect(summarizeAssets([]).bytes).toBe(0);
});
it('rejects non-build assets', () => {
  expect(() =>
    describeAsset('http://localhost/api/markets', Buffer.from('')),
  ).toThrow();
});
