import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { generateMarketRecords } from '../data/generate-market-records';
import { VirtualMarketExpansion } from './VirtualMarketExpansion';

const record = generateMarketRecords({ count: 1, seed: 42 })[0];
it('shows a record snapshot with a range derived from history and UTC metadata', () => {
  render(
    <table>
      <tbody>
        <tr>
          <VirtualMarketExpansion
            record={{
              ...record,
              chartHistory: [
                { timestamp: record.updatedAt, price: 10 },
                { timestamp: record.updatedAt, price: 25 },
                { timestamp: record.updatedAt, price: 15 },
              ],
            }}
          />
        </tr>
      </tbody>
    </table>,
  );
  expect(
    screen.getByRole('region', { name: `Snapshot for ${record.name}` }),
  ).toBeVisible();
  expect(screen.getByText('$10.00 – $25.00')).toBeVisible();
  expect(screen.getByText(record.id)).toBeVisible();
  expect(screen.getByText(/3 history points/)).toBeVisible();
  expect(screen.getByText(/UTC$/)).toHaveAttribute(
    'datetime',
    record.updatedAt,
  );
});
it('does not invent a range when history is empty', () => {
  render(
    <table>
      <tbody>
        <tr>
          <VirtualMarketExpansion record={{ ...record, chartHistory: [] }} />
        </tr>
      </tbody>
    </table>,
  );
  expect(screen.getByText('No history available')).toBeVisible();
  expect(screen.getByText(/0 history points/)).toBeVisible();
});
