import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
export function describeAsset(url: string, body: Buffer) {
  const path = new URL(url).pathname;
  if (
    !path.startsWith('/_next/static/') ||
    !path.endsWith('.js') ||
    path.includes('..')
  )
    throw new Error('Unexpected JS asset path');
  return {
    path,
    bytes: body.length,
    gzipBytes: gzipSync(body).length,
    sha256: createHash('sha256').update(body).digest('hex'),
  };
}
export function summarizeAssets(assets: ReturnType<typeof describeAsset>[]) {
  const unique = [
    ...new Map(assets.map((asset) => [asset.path, asset])).values(),
  ];
  return {
    unit: 'bytes',
    aggregation: 'sum' as const,
    sampleCount: 1,
    bytes: unique.reduce((sum, asset) => sum + asset.bytes, 0),
    gzipBytes: unique.reduce((sum, asset) => sum + asset.gzipBytes, 0),
    assets: unique,
  };
}
