import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BaselineRenderBoundarySummary } from '../baseline/RenderBoundarySummary';
import { OptimizedRenderBoundarySummary } from '../optimized/RenderBoundarySummary';
import { generateMarketRecords } from '../data/generate-market-records';
import { summarizeMarkets } from '../api/market-api';
const summary = summarizeMarkets(
  generateMarketRecords({ seed: 20260911, count: 20 }),
);
afterEach(() => vi.unstubAllEnvs());
for (const [name, Component] of [
  ['baseline', BaselineRenderBoundarySummary],
  ['optimized', OptimizedRenderBoundarySummary],
] as const) {
  it(`${name} has matching behavior and scoped commit instrumentation under StrictMode`, () => {
    vi.stubEnv('NODE_ENV', 'development');
    const view = render(
      <StrictMode>
        <Component summary={summary} />
      </StrictMode>,
    );
    const count = () =>
      Number(screen.getByTestId('summary-render-commits').textContent);
    const initial = count();
    const initialSummary = screen.getByTestId('market-summary').textContent;
    for (const note of ['a', 'ab', 'abc'])
      fireEvent.change(
        screen.getByRole('textbox', { name: 'Comparison note' }),
        { target: { value: note } },
      );
    expect(screen.getByTestId('boundary-note')).toHaveValue('abc');
    expect(screen.getByTestId('market-summary').textContent).toBe(
      initialSummary,
    );
    if (name === 'baseline') expect(count()).toBeGreaterThan(initial);
    else expect(count()).toBe(initial);
    const beforeInspection = count();
    fireEvent.click(screen.getByRole('button', { name: 'Explain summary' }));
    expect(
      screen.getByText('Summary reflects the complete dataset.'),
    ).toHaveTextContent('Summary reflects the complete dataset.');
    if (name === 'baseline') expect(count()).toBeGreaterThan(beforeInspection);
    else expect(count()).toBe(beforeInspection);
    const beforeData = count();
    const changed = summarizeMarkets(
      generateMarketRecords({ seed: 42, count: 3 }),
    );
    view.rerender(
      <StrictMode>
        <Component summary={changed} />
      </StrictMode>,
    );
    expect(count()).toBeGreaterThan(beforeData);
    expect(screen.getByTestId('market-summary')).toHaveTextContent(
      String(changed.totalVolume.toLocaleString('en-US')),
    );
    expect(screen.getByTestId('boundary-note')).toHaveValue('abc');
    view.unmount();
    render(<Component summary={summary} />);
    expect(screen.getByTestId('boundary-note')).toHaveValue('');
    expect(
      screen.queryByText('Summary reflects the complete dataset.'),
    ).not.toBeInTheDocument();
  });
  it(`${name} omits instrumentation in production`, () => {
    vi.stubEnv('NODE_ENV', 'production');
    render(<Component summary={summary} />);
    fireEvent.change(screen.getByTestId('boundary-note'), {
      target: { value: 'note' },
    });
    expect(
      screen.queryByTestId('summary-render-commits'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('boundary-note')).toHaveValue('note');
  });
}
