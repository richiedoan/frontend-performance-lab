// @vitest-environment node
import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import {
  layerAttribution,
  layerLimits,
  selectAttribution,
} from './diagnostic-layers';
function fixture(overrides = {}) {
  const session = Object.assign(new EventEmitter(), {
    send: vi.fn(async () => ({})),
    detach: vi.fn(async () => {}),
  });
  const persist = vi.fn();
  const collector = layerAttribution(session, persist, {
    ...layerLimits,
    ...overrides,
  });
  return { session, persist, collector };
}
afterEach(() => vi.useRealTimers());
it('is opt-in and rejects invalid or repeated modes', () => {
  expect(selectAttribution([]).mode).toBe('none');
  expect(selectAttribution(['--attribution=layers', '--trace=chrome'])).toEqual(
    { mode: 'layers', args: ['--trace=chrome'] },
  );
  expect(() => selectAttribution(['--attribution=all'])).toThrow();
  expect(() =>
    selectAttribution(['--attribution=layers', '--attribution=layers']),
  ).toThrow();
});
it('retains missing trees and unmappable layers rather than inventing nodes', async () => {
  const { collector, session, persist } = fixture();
  await collector.start();
  await collector.capture('missing');
  session.emit('LayerTree.layerTreeDidChange', {
    layers: [{ layerId: '1', width: 1, height: 1, drawsContent: true }],
  });
  await collector.capture('tree');
  await collector.close();
  const data = JSON.stringify(persist.mock.calls.at(-1));
  expect(data).toContain('"missing":true');
  expect(data).toContain('mapping-unavailable');
  expect(session.send.mock.calls.flat()).not.toContain('DOM.describeNode');
  expect(session.listenerCount('LayerTree.layerTreeDidChange')).toBe(0);
  expect(session.listenerCount('LayerTree.layerPainted')).toBe(0);
  expect(session.detach).toHaveBeenCalledOnce();
});
it('caps snapshots, requests and bytes while persisting raw responses', async () => {
  const { collector, session, persist } = fixture({
    requests: 5,
    layers: 2,
    mappedPerSnapshot: 2,
    recordBytes: 400,
  });
  session.emit('LayerTree.layerTreeDidChange', {
    layers: Array.from({ length: 100 }, (_, i) => ({
      layerId: String(i),
      backendNodeId: i + 1,
      width: 10,
      height: 10,
      drawsContent: true,
    })),
  });
  await collector.start();
  for (let i = 0; i < 6; i++) await collector.capture(String(i));
  session.emit('LayerTree.layerPainted', { huge: 'x'.repeat(1000) });
  await collector.close();
  expect(session.send.mock.calls.length).toBeLessThanOrEqual(5);
  const data = persist.mock.calls.at(-1)![0];
  expect(data.dropped).toBeGreaterThan(0);
  expect(data.bytes).toBeLessThan(layerLimits.bytes);
  expect(JSON.stringify(data)).toContain('response');
  expect(JSON.stringify(data)).toContain('snapshot-skipped');
});
it('stops requests on CDP failure but disables and detaches during cleanup', async () => {
  const { collector, session, persist } = fixture();
  session.send.mockRejectedValue(new Error('Method not found'));
  await collector.start();
  await collector.capture('unsupported');
  await collector.close();
  expect(session.send).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(persist.mock.calls.at(-1))).toContain(
    'failed-or-unsupported',
  );
  expect(session.detach).toHaveBeenCalledOnce();
});
it('bounds hung requests and detach without polling or real waits', async () => {
  vi.useFakeTimers();
  const { collector, session, persist } = fixture({ requestMs: 5 });
  session.send.mockImplementation(() => new Promise(() => {}));
  session.detach.mockImplementation(() => new Promise(() => {}));
  const start = collector.start();
  await vi.advanceTimersByTimeAsync(5);
  await start;
  const close = collector.close();
  await vi.advanceTimersByTimeAsync(10);
  await close;
  expect(JSON.stringify(persist.mock.calls.at(-1))).toContain('timeout');
  expect(JSON.stringify(persist.mock.calls.at(-1))).toContain('detach-failure');
  expect(vi.getTimerCount()).toBe(0);
  expect(session.listenerCount('LayerTree.layerPainted')).toBe(0);
});
