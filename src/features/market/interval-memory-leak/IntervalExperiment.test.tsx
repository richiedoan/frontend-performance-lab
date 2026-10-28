import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { generateMarketRecords } from '../data/generate-market-records';
import { IntervalExperiment } from './IntervalExperiment';
import {
  INTERVAL_MS,
  MAX_TICKS,
  MAX_ACTIVE_INTERVALS,
  startIntervalSession,
  type IntervalEvent,
} from './interval-session';
const records = generateMarketRecords({ count: 300 });
afterEach(async () => {
  await vi.runAllTimersAsync();
  vi.useRealTimers();
});
for (const optimized of [false, true]) {
  it(`${optimized} repeated StrictMode mount/unmount leaves only the intended timers`, async () => {
    vi.useFakeTimers();
    const before = vi.getTimerCount();
    for (let i = 0; i < 5; i++) {
      const view = render(
        <StrictMode>
          <IntervalExperiment records={records} optimized={optimized} />
        </StrictMode>,
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(INTERVAL_MS);
      });
      expect(screen.getByTestId('interval-experiment')).toHaveAttribute(
        'data-tick',
        '1',
      );
      view.unmount();
      expect(vi.getTimerCount()).toBe(
        optimized ? before : Math.min((i + 1) * 2, MAX_ACTIVE_INTERVALS),
      );
    }
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * MAX_TICKS);
    expect(vi.getTimerCount()).toBe(before);
  });
  it(`${optimized} detached work retains bounded meaningful data but never publishes to React`, async () => {
    vi.useFakeTimers();
    const events: IntervalEvent[] = [];
    const publish = vi.fn();
    const session = startIntervalSession(records, optimized, publish, (event) =>
      events.push(event),
    );
    session.unmount();
    const calls = publish.mock.calls.length;
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(publish).toHaveBeenCalledTimes(calls);
    const ticks = events.filter((event) => event.phase === 'tick');
    expect(ticks).toHaveLength(optimized ? 0 : 1);
    if (!optimized)
      expect(ticks[0]).toMatchObject({
        mounted: false,
        records: 250,
        totalVolume: records
          .slice(0, 250)
          .reduce((sum, record) => sum + record.volume, 0),
      });
    await vi.runAllTimersAsync();
    expect(vi.getTimerCount()).toBe(0);
    expect(events.at(-1)).toMatchObject({ phase: 'stop', records: 0 });
  });
}
it('optimized replaces the previous snapshot on changed dataset without stale ticks', async () => {
  vi.useFakeTimers();
  const view = render(<IntervalExperiment records={records} optimized />);
  const next = generateMarketRecords({ count: 2, seed: 42 });
  view.rerender(<IntervalExperiment records={next} optimized />);
  expect(vi.getTimerCount()).toBe(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
  });
  expect(screen.getByRole('status')).toHaveTextContent(
    'across 2 sampled records',
  );
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
