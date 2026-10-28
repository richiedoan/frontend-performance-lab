import { performance } from 'node:perf_hooks';

/** Every phase persists its start as well as completion, including interrupted work. */
export function diagnosticPhases(
  persist: (value: unknown) => void,
  signal: AbortSignal,
  now = () => performance.now(),
) {
  const started = now();
  const phases: {
    name: string;
    timestamp: string;
    startMs: number;
    durationMs?: number;
    status: string;
    error?: string;
  }[] = [];
  return async function phase<T>(
    name: string,
    action: () => Promise<T>,
  ): Promise<T> {
    signal.throwIfAborted();
    const item = {
      name,
      timestamp: new Date().toISOString(),
      startMs: now() - started,
      status: 'incomplete',
    } as (typeof phases)[number];
    phases.push(item);
    persist(phases);
    let abort: () => void = () => {};
    try {
      const value = await Promise.race([
        action(),
        new Promise<never>((_, reject) => {
          abort = () => reject(signal.reason);
          signal.addEventListener('abort', abort, { once: true });
          if (signal.aborted) abort();
        }),
      ]);
      item.status = 'completed';
      return value;
    } catch (error) {
      item.error = String(error);
      throw error;
    } finally {
      signal.removeEventListener('abort', abort);
      item.durationMs = now() - started - item.startMs;
      persist(phases);
    }
  };
}

export async function diagnosticLifecycle(
  phase: ReturnType<typeof diagnosticPhases>,
  steps: {
    preflight: () => Promise<unknown>;
    build: () => Promise<unknown>;
    journey: () => Promise<unknown>;
    cleanup: () => Promise<unknown>;
  },
) {
  try {
    await phase('preflight', steps.preflight);
    await phase('build', steps.build);
    await phase('journey', steps.journey);
  } finally {
    await steps.cleanup();
  }
}

/** Cleanup receives its own deadline, independent of the aborted work signal. */
export async function boundedCleanup(
  action: () => Promise<unknown>,
  timeoutMs = 10000,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      action(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Cleanup deadline exceeded')),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
