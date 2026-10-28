import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { CaseStudy } from './CaseStudy';
it('ignores stale StrictMode response and aborts pending work on unmount', async () => {
  const pending: {
    resolve: (response: Response) => void;
    signal: AbortSignal;
  }[] = [];
  const mock = vi.spyOn(globalThis, 'fetch').mockImplementation(
    (_url, init) =>
      new Promise((resolve) => {
        pending.push({ resolve, signal: init!.signal as AbortSignal });
      }),
  );
  try {
    const view = render(
      <StrictMode>
        <CaseStudy />
      </StrictMode>,
    );
    expect(pending).toHaveLength(2);
    expect(pending[0].signal.aborted).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    await act(async () =>
      pending[1].resolve(new Response(JSON.stringify({ records: [] }))),
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'No experiment records available',
    );
    await act(async () =>
      pending[0].resolve(new Response('{}', { status: 500 })),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    view.unmount();
    expect(pending[1].signal.aborted).toBe(true);
  } finally {
    mock.mockRestore();
  }
});

it.each([2, 1, 0])(
  'shows journey evidence and unavailable states for %i eligible approaches',
  async (count) => {
    const { summarizeCaseStudy } = await import('../data/summaries/case-study');
    const { measuredFixture } =
      await import('../data/validation/fixtures/evidence-fixture');
    const { plannedDefinitions } = await import('../data/definitions/planned');
    const definition = {
      ...plannedDefinitions[0],
      metrics: [{ id: 'journey-duration', unit: 'ms' as const }],
    };
    const run = measuredFixture('journey-fixture', 'a'.repeat(64));
    const measured = run.results[0].result;
    if (measured.status !== 'measured') throw new Error('Fixture');
    run.results = (['baseline', 'optimized'] as const).map(
      (approach, index) => ({
        approach,
        metricId: 'journey-duration',
        result:
          index < count
            ? {
                ...measured,
                unit: 'ms',
                value: index ? 5 : 10,
                extraction:
                  'journey/median-v1; readiness dataset-then-table-v1',
              }
            : {
                status: 'not-available',
                reason: 'Requires five successful samples; 4/5 valid.',
              },
      }),
    );
    const records = summarizeCaseStudy([{ definition, runs: [run] }]);
    const mock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ records })));
    try {
      render(<CaseStudy />);
      expect(
        await screen.findByRole('heading', { name: 'Journey duration' }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/including automation and network waits/),
      ).toHaveTextContent('not INP, LCP or algorithm-only time');
      expect(
        screen.queryAllByRole('link', { name: /^Evidence:/ }),
      ).toHaveLength(count);
      expect(screen.queryAllByText(/Median · 5 samples/)).toHaveLength(count);
      expect(
        screen.queryAllByText(/Extraction:.*dataset-then-table-v1/),
      ).toHaveLength(count);
      if (count === 2) expect(screen.getByText(/50.00%/)).toBeInTheDocument();
      else {
        expect(
          screen.queryByText(/lower than baseline/),
        ).not.toBeInTheDocument();
        expect(screen.getByText(/Comparison unavailable:/)).toBeInTheDocument();
        expect(
          screen.getAllByText(/Requires five successful samples/),
        ).toHaveLength(2 - count);
      }
    } finally {
      mock.mockRestore();
    }
  },
);
