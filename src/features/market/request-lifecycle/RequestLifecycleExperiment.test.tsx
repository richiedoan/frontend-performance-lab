import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RequestLifecycleExperiment } from './RequestLifecycleExperiment';
import { generateMarketRecords } from '../data/generate-market-records';
afterEach(() => vi.useRealTimers());
it('StrictMode keeps a finite batch and cancels on unmount', async () => {
  vi.useFakeTimers();
  const records = generateMarketRecords({ count: 3 });
  const view = render(
    <StrictMode>
      <RequestLifecycleExperiment records={records} optimized />
    </StrictMode>,
  );
  const button = screen.getByRole('button', { name: 'Run request race' });
  fireEvent.click(button);
  expect(button).toBeDisabled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(screen.getByTestId('lifecycle-result')).toHaveTextContent(
    records[2].name,
  );
  expect(button).toBeEnabled();
  fireEvent.click(button);
  view.unmount();
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(vi.getTimerCount()).toBe(0);
});
it('empty data prevents dispatch', () => {
  render(<RequestLifecycleExperiment records={[]} optimized />);
  expect(
    screen.getByRole('button', { name: 'Run request race' }),
  ).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('At least two records');
});
