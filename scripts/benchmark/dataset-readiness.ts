import type { Page } from '@playwright/test';

export const journeyReadinessPolicy = {
  id: 'dataset-then-table-v1',
  datasetTimeoutMs: 90000,
  tableTimeoutMs: 90000,
} as const;

/** Arm before navigation; headers alone do not mean a throttled body is ready. */
export async function waitForDataset(page: Page, query: string): Promise<void> {
  const timeout = journeyReadinessPolicy.datasetTimeoutMs;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all(
        ['/api/markets', '/api/markets/summary'].map(async (path) => {
          const response = await page.waitForResponse(
            `http://127.0.0.1:3101${path}?${query}`,
            { timeout },
          );
          if (!response.ok())
            throw new Error(`Dataset ${path}: HTTP ${response.status()}`);
          const failure = await response.finished();
          if (failure) throw new Error(`Dataset ${path}: ${failure.message}`);
        }),
      ),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(`Dataset bodies did not complete within ${timeout}ms`),
            ),
          timeout,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
