import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { generateMarketRecords } from '../data/generate-market-records';
import { ListenerExperiment } from './ListenerExperiment';
import {
  dispatchListenerProbe,
  startListenerSession,
  LISTENER_EVENTS,
  MAX_LISTENERS,
  type ListenerSample,
} from './listener-session';
const records = generateMarketRecords({ count: 300 });
afterEach(() => {
  dispatchListenerProbe(false, true);
  dispatchListenerProbe(true, true);
  vi.restoreAllMocks();
});
for (const optimized of [false, true]) {
  it(`${optimized} accumulates only the deliberate detached handlers`, () => {
    const samples: ListenerSample[] = [];
    const publish = vi.fn();
    for (let i = 0; i < 3; i++)
      startListenerSession(records, optimized, publish, (sample) =>
        samples.push(sample),
      ).unmount();
    const calls = publish.mock.calls.length;
    dispatchListenerProbe(optimized);
    const dispatched = samples.filter((sample) => sample.phase === 'dispatch');
    expect(dispatched).toHaveLength(optimized ? 0 : 3);
    for (const sample of dispatched)
      expect(sample).toMatchObject({
        mounted: false,
        records: 250,
        volume: records
          .slice(0, 250)
          .reduce((total, record) => total + record.volume, 0),
      });
    expect(publish).toHaveBeenCalledTimes(calls);
    dispatchListenerProbe(!optimized);
    expect(
      samples.filter((sample) => sample.phase === 'dispatch'),
    ).toHaveLength(dispatched.length);
  });
  it(`${optimized} repeated StrictMode mount/unmount has matching listener identity and behavior`, () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    for (let i = 0; i < 3; i++) {
      const view = render(
        <StrictMode>
          <ListenerExperiment records={records} optimized={optimized} />
        </StrictMode>,
      );
      fireEvent.click(
        screen.getByRole('button', { name: 'Dispatch listener probe' }),
      );
      expect(screen.getByRole('status')).toHaveTextContent(
        '250 sampled records',
      );
      view.unmount();
    }
    const registrations = add.mock.calls.filter(
      (call) =>
        call[0] === LISTENER_EVENTS[optimized ? 'optimized' : 'baseline'],
    );
    const removals = remove.mock.calls.filter(
      (call) =>
        call[0] === LISTENER_EVENTS[optimized ? 'optimized' : 'baseline'],
    );
    expect(registrations).toHaveLength(6);
    expect(removals).toHaveLength(optimized ? 6 : 0);
    if (optimized)
      registrations.forEach((call, index) =>
        expect(removals[index]).toEqual(call),
      );
  });
}
it('baseline admission cap and explicit reset bound retention without timers', () => {
  const samples: ListenerSample[] = [];
  for (let i = 0; i < 12; i++)
    startListenerSession(
      records,
      false,
      () => {},
      (sample) => samples.push(sample),
    ).unmount();
  dispatchListenerProbe(false);
  expect(samples.filter((sample) => sample.phase === 'dispatch')).toHaveLength(
    MAX_LISTENERS,
  );
  expect(samples.filter((sample) => sample.phase === 'limit')).toHaveLength(4);
  dispatchListenerProbe(false, true);
  const count = samples.length;
  dispatchListenerProbe(false);
  expect(samples).toHaveLength(count);
  expect(samples.at(-1)).toMatchObject({
    phase: 'remove',
    active: 0,
    records: 0,
  });
});
it('optimized changes dataset without retaining stale handlers', () => {
  const view = render(<ListenerExperiment records={records} optimized />);
  view.rerender(<ListenerExperiment records={records.slice(0, 2)} optimized />);
  act(() => dispatchListenerProbe(true));
  expect(screen.getByRole('status')).toHaveTextContent('2 sampled records');
  fireEvent.click(
    screen.getByRole('button', { name: 'Reset experiment listeners' }),
  );
  expect(screen.getByRole('status')).toHaveTextContent('Listeners removed');
  view.unmount();
});
