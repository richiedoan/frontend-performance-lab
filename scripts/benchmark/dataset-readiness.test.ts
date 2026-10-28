// @vitest-environment node
import type { Page, Response } from '@playwright/test';
import { afterEach, expect, it, vi } from 'vitest';
import { waitForDataset } from './dataset-readiness';

afterEach(() => {
  vi.useRealTimers();
});

function fixture() {
  let finishCollection!: (error: Error | null) => void;
  let finishSummary!: (error: Error | null) => void;
  const collection = new Promise<Error | null>((resolve) => {
    finishCollection = resolve;
  });
  const summary = new Promise<Error | null>((resolve) => {
    finishSummary = resolve;
  });
  const response = (finished: Promise<Error | null>) =>
    ({
      ok: () => true,
      status: () => 200,
      finished: () => finished,
    }) as Response;
  const waitForResponse = vi
    .fn()
    .mockImplementation((url: string) =>
      Promise.resolve(
        response(url.includes('/summary?') ? summary : collection),
      ),
    );
  const page = { waitForResponse } as unknown as Page;
  return { page, waitForResponse, finishCollection, finishSummary };
}

it('waits for both complete bodies, not just response headers', async () => {
  vi.useFakeTimers();
  const f = fixture();
  let ready = false;
  const waiting = waitForDataset(f.page, 'count=5000').then(() => {
    ready = true;
  });
  await vi.advanceTimersByTimeAsync(52000);
  expect(ready).toBe(false);
  f.finishCollection(null);
  await vi.advanceTimersByTimeAsync(0);
  expect(ready).toBe(false);
  f.finishSummary(null);
  await waiting;
  expect(ready).toBe(true);
  expect(f.waitForResponse.mock.calls.map(([url]) => url)).toEqual([
    'http://127.0.0.1:3101/api/markets?count=5000',
    'http://127.0.0.1:3101/api/markets/summary?count=5000',
  ]);
  expect(vi.getTimerCount()).toBe(0);
});

it('bounds body transfer even when headers arrive but the body stalls', async () => {
  vi.useFakeTimers();
  const f = fixture();
  const waiting = expect(waitForDataset(f.page, 'count=5000')).rejects.toThrow(
    'Dataset bodies did not complete within 90000ms',
  );
  await vi.advanceTimersByTimeAsync(90000);
  await waiting;
  f.finishCollection(null);
  f.finishSummary(null);
  expect(vi.getTimerCount()).toBe(0);
});

it('rejects failed transfers instead of treating headers as success', async () => {
  vi.useFakeTimers();
  const f = fixture();
  const waiting = expect(waitForDataset(f.page, 'count=5000')).rejects.toThrow(
    'connection closed',
  );
  f.finishCollection(new Error('connection closed'));
  f.finishSummary(null);
  await waiting;
  expect(vi.getTimerCount()).toBe(0);
});

it('reports API HTTP failures and removes its deadline timer', async () => {
  vi.useFakeTimers();
  const f = fixture();
  f.waitForResponse.mockResolvedValue({ ok: () => false, status: () => 500 });
  await expect(waitForDataset(f.page, '')).rejects.toThrow('HTTP 500');
  expect(vi.getTimerCount()).toBe(0);
});
