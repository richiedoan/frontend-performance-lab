import { expect, it, vi } from 'vitest';
import {
  collectCycles,
  readMemoryConfig,
  measured,
  unavailable,
  validateRawMemoryRun,
  type Cycle,
  type Adapter,
  type RawMemoryRun,
} from './model';
function adapter(): Adapter {
  return {
    journey: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
    gc: vi.fn().mockResolvedValue(undefined),
    heap: vi.fn().mockResolvedValue(measured(123, 'bytes')),
    dom: vi.fn().mockResolvedValue(measured(10, 'nodes')),
    detached: vi.fn().mockResolvedValue(unavailable('Unsupported in fixture')),
    errors: () => [],
  };
}
async function fixture(mode = 'benchmark') {
  const config = readMemoryConfig({
    MEMORY_MODE: mode,
    MEMORY_ROUTE: 'baseline',
    MEMORY_COUNT: '3',
  });
  const cycles: Cycle[] = [];
  const source = adapter();
  await collectCycles(config, source, async (cycle) => {
    cycles.push(cycle);
  });
  const raw: RawMemoryRun = {
    schemaVersion: 1,
    status: 'complete',
    config,
    environment: {
      node: 'test fixture',
      viewport: { width: 1280, height: 720 },
      buildId: 'fixture',
    },
    routes: [
      {
        route: 'baseline',
        browser: { product: 'fixture browser', protocolVersion: 'fixture' },
        recordId: 'fixture-id',
        failures: [],
        cycles,
      },
    ],
  };
  return { raw, source };
}
it('keeps all ten attempts including failures and subsequent cycles', async () => {
  const config = readMemoryConfig({ MEMORY_MODE: 'benchmark' });
  const source = adapter();
  vi.mocked(source.journey).mockRejectedValueOnce(new Error('fixture failure'));
  const cycles: Cycle[] = [];
  await collectCycles(config, source, async (c) => {
    cycles.push(c);
  });
  expect(cycles).toHaveLength(10);
  expect(cycles[0].status).toBe('failed');
  expect(cycles[0].failures[0].message).toBe('fixture failure');
  expect(cycles[9].status).toBe('success');
  expect(source.gc).toHaveBeenCalledTimes(10);
});
it('dry-run and test modes never invoke GC or measure memory', async () => {
  for (const mode of ['dry-run', 'test']) {
    const { raw, source } = await fixture(mode);
    validateRawMemoryRun(raw);
    expect(source.gc).not.toHaveBeenCalled();
    expect(source.heap).not.toHaveBeenCalled();
    expect(raw.routes[0].cycles[0].usedHeap.status).toBe('not-available');
    expect(source.journey).toHaveBeenCalledTimes(mode === 'dry-run' ? 0 : 10);
  }
});
it('rejects GC without launch authorization and preserves every setup failure', async () => {
  const config = readMemoryConfig({ MEMORY_MODE: 'benchmark' });
  config.flags = [];
  const source = adapter();
  const cycles: Cycle[] = [];
  await collectCycles(config, source, async (c) => {
    cycles.push(c);
  });
  expect(source.gc).not.toHaveBeenCalled();
  expect(cycles.every((c) => c.gc === 'failed' && c.status === 'failed')).toBe(
    true,
  );
  const failed: Cycle[] = [];
  await collectCycles(
    config,
    null,
    async (c) => {
      failed.push(c);
    },
    'Launch failed',
  );
  expect(failed).toHaveLength(10);
  expect(failed.every((c) => c.failures[0].message === 'Launch failed')).toBe(
    true,
  );
});
it('validates metrics, units, complete cycles, unavailable reasons and dry-run claims', async () => {
  const { raw } = await fixture();
  expect(validateRawMemoryRun(raw)).toBe(raw);
  const missing = structuredClone(raw);
  missing.routes[0].cycles.pop();
  expect(() => validateRawMemoryRun(missing)).toThrow();
  const invalid = structuredClone(raw);
  invalid.routes[0].cycles[0].usedHeap = measured(1, 'nodes');
  expect(() => validateRawMemoryRun(invalid)).toThrow();
  const reason = structuredClone(raw);
  reason.routes[0].cycles[0].detachedTrees = unavailable('');
  expect(() => validateRawMemoryRun(reason)).toThrow();
  const dry = (await fixture('dry-run')).raw;
  dry.routes[0].cycles[0].usedHeap = measured(1, 'bytes');
  expect(() => validateRawMemoryRun(dry)).toThrow();
});
it('validates configuration and keeps the same conditions for both routes', () => {
  const config = readMemoryConfig({});
  expect(config.routes).toEqual(['baseline', 'optimized']);
  expect(config.mode).toBe('dry-run');
  for (const env of [
    { MEMORY_ROUTE: 'reference' },
    { MEMORY_SCENARIO: 'unknown' },
    { MEMORY_COUNT: '0' },
    { MEMORY_CLEANUP_MS: '99999' },
    { MEMORY_SEED: 'oops' },
    { MEMORY_MODE: 'fake' },
  ])
    expect(() => readMemoryConfig(env)).toThrow();
});
