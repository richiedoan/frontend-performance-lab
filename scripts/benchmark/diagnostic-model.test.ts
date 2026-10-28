// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import {
  diagnosticPhases,
  diagnosticLifecycle,
  boundedCleanup,
} from './diagnostic-model';

describe('diagnostic orchestration', () => {
  it('persists phase start and duration with a monotonic clock', async () => {
    let now = 10;
    const snapshots: unknown[] = [];
    const phase = diagnosticPhases(
      (value) => snapshots.push(structuredClone(value)),
      new AbortController().signal,
      () => now,
    );
    await phase('navigation', async () => {
      now = 25;
    });
    expect(snapshots[0]).toEqual([
      expect.objectContaining({ status: 'incomplete', startMs: 0 }),
    ]);
    expect(snapshots[1]).toEqual([
      expect.objectContaining({ status: 'completed', durationMs: 15 }),
    ]);
  });
  it.each(['timeout', 'SIGINT'])(
    'retains partial evidence and cleans up on %s',
    async (reason) => {
      const controller = new AbortController();
      const snapshots: unknown[] = [];
      const phase = diagnosticPhases(
        (value) => snapshots.push(structuredClone(value)),
        controller.signal,
      );
      const cleanup = vi.fn(async () => {});
      const run = diagnosticLifecycle(phase, {
        preflight: async () => {},
        build: async () => {},
        journey: async () => {
          controller.abort(new Error(reason));
          await new Promise(() => {});
        },
        cleanup,
      });
      await expect(run).rejects.toThrow(reason);
      expect(cleanup).toHaveBeenCalledOnce();
      expect(snapshots.at(-1)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'journey',
            status: 'incomplete',
            error: `Error: ${reason}`,
          }),
        ]),
      );
    },
  );
  it('stops dependent work after preflight failure and still cleans up', async () => {
    const build = vi.fn();
    const journey = vi.fn();
    const cleanup = vi.fn();
    await expect(
      diagnosticLifecycle(
        diagnosticPhases(() => {}, new AbortController().signal),
        {
          preflight: async () => {
            throw new Error('preflight failed');
          },
          build,
          journey,
          cleanup,
        },
      ),
    ).rejects.toThrow('preflight failed');
    expect(build).not.toHaveBeenCalled();
    expect(journey).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledOnce();
  });
});

it('bounds a stalled cleanup without real waiting and clears its timer', async () => {
  vi.useFakeTimers();
  try {
    const cleanup = boundedCleanup(() => new Promise(() => {}), 20);
    const assertion = expect(cleanup).rejects.toThrow(
      'Cleanup deadline exceeded',
    );
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
    await boundedCleanup(async () => {}, 20);
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
