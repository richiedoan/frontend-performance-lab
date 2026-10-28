import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TranslationProvider, useTranslation } from './useTranslation';
import { LanguageSelect } from './LanguageSelect';
import { MarketToolbar } from '../features/market/components/MarketToolbar';
import {
  LoadingSkeleton,
  EmptyState,
  ErrorState,
} from '../features/market/components/MarketStates';
import { MarketTable } from '../features/market/components/MarketTable';
import { DetailChart } from '../features/market/components/DetailChart';
import { CaseStudy } from '../experiments/components/CaseStudy';
import { generateMarketRecords } from '../features/market/data/generate-market-records';
import { getCaseStudyRecords } from '../experiments/data/catalog/case-study-records';
import { summarizeCaseStudy } from '../experiments/data/summaries/case-study';
import { enUi, viUi } from './languages/ui';

const vietnamese = () =>
  fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), {
    target: { value: 'vi' },
  });
afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.lang = 'en';
});

it('translates controls without changing filter values or callbacks', () => {
  const onFiltersChange = vi.fn();
  const onSearchChange = vi.fn();
  render(
    <TranslationProvider>
      <LanguageSelect />
      <MarketToolbar
        search="Market 1"
        filters={{ category: 'technology', status: 'active' }}
        onFiltersChange={onFiltersChange}
        onSearchChange={onSearchChange}
        onRefresh={vi.fn()}
      />
    </TranslationProvider>,
  );
  vietnamese();
  expect(document.documentElement).toHaveAttribute('lang', 'vi');
  expect(
    screen.getByRole('searchbox', { name: 'Tìm kiếm thị trường' }),
  ).toHaveValue('Market 1');
  const category = screen.getByRole('combobox', { name: 'Danh mục' });
  expect(category).toHaveValue('technology');
  expect(
    within(category).getByRole('option', { name: 'công nghệ' }),
  ).toHaveAttribute('value', 'technology');
  fireEvent.change(category, { target: { value: 'energy' } });
  expect(onFiltersChange).toHaveBeenLastCalledWith({
    category: 'energy',
    status: 'active',
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Trạng thái' }), {
    target: { value: 'paused' },
  });
  expect(onFiltersChange).toHaveBeenLastCalledWith({
    category: 'technology',
    status: 'paused',
  });
  expect(onSearchChange).not.toHaveBeenCalled();
});

it('translates shared loading, empty and error states while preserving Retry', () => {
  const retry = vi.fn();
  render(
    <TranslationProvider>
      <LanguageSelect />
      <LoadingSkeleton />
      <EmptyState />
      <ErrorState
        message="Unable to load markets (HTTP 500). Check the dataset parameters and retry."
        onRetry={retry}
      />
    </TranslationProvider>,
  );
  vietnamese();
  expect(
    screen.getByText('Đang tải thị trường…').closest('[role="status"]'),
  ).toBeVisible();
  expect(
    screen.getByText('Không có thị trường phù hợp với lựa chọn.'),
  ).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Không thể tải thị trường (HTTP 500). Kiểm tra tham số dữ liệu và thử lại.',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(retry).toHaveBeenCalledTimes(1);
});

it('localizes row actions, chart names and numbers without changing record identities', () => {
  const records = generateMarketRecords({ seed: 42, count: 1 });
  const record = records[0];
  const onSelect = vi.fn();
  const onSort = vi.fn();
  render(
    <TranslationProvider>
      <LanguageSelect />
      <MarketTable
        records={records}
        sort={{ key: 'name', direction: 'ascending' }}
        onSort={onSort}
        onSelect={onSelect}
        expansion={{ expandedIds: [], onToggle: vi.fn() }}
      />
      <DetailChart record={record} />
    </TranslationProvider>,
  );
  vietnamese();
  expect(screen.getByTestId('market-row')).toHaveAttribute(
    'data-market-id',
    record.id,
  );
  fireEvent.click(
    screen.getByRole('button', { name: `Xem chi tiết ${record.name}` }),
  );
  expect(onSelect).toHaveBeenCalledWith(record.id);
  fireEvent.click(screen.getByRole('button', { name: 'Sắp xếp theo giá' }));
  expect(onSort).toHaveBeenCalledWith('price');
  expect(
    screen.getByRole('button', { name: `Mở rộng ${record.name}` }),
  ).toBeVisible();
  expect(
    screen.getByRole('img', {
      name: `Lịch sử giá của ${record.name}, 24 điểm theo USD`,
    }),
  ).toBeVisible();
  expect(screen.getByText(record.volume.toLocaleString('vi-VN'))).toBeVisible();
});

it('keeps a pending Case Study load alive while changing language and translates its catalog', async () => {
  let resolve!: (response: Response) => void;
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  render(
    <TranslationProvider>
      <LanguageSelect />
      <CaseStudy />
    </TranslationProvider>,
  );
  vietnamese();
  expect(screen.getByRole('status')).toHaveTextContent(
    'Đang tải bản ghi thí nghiệm…',
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () =>
    resolve(
      new Response(
        JSON.stringify({
          records: summarizeCaseStudy(getCaseStudyRecords()),
          investigations: [],
        }),
      ),
    ),
  );
  expect(screen.getByRole('heading', { name: 'Danh sách lớn' })).toBeVisible();
  expect(
    screen.getByText(
      'Thay đổi vùng render có thể ảnh hưởng đến số node DOM; đây là giả thuyết chưa được đo.',
    ),
  ).toBeVisible();
  expect(
    screen.getAllByText(/Chưa thu thập benchmark cho thí nghiệm dự kiến này/)
      .length,
  ).toBeGreaterThan(0);
  expect(screen.getByRole('heading', { name: 'Giới hạn' })).toBeVisible();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('translates bounded configuration errors and preserves unknown source text', () => {
  function Messages() {
    const t = useTranslation();
    return (
      <>
        <p>{t.text('count must be an integer between 0 and 10000')}</p>
        <p>{t.text('External evidence note: unchanged')}</p>
      </>
    );
  }
  render(
    <TranslationProvider>
      <LanguageSelect />
      <Messages />
    </TranslationProvider>,
  );
  vietnamese();
  expect(
    screen.getByText('count phải là số nguyên từ 0 đến 10000'),
  ).toBeVisible();
  expect(screen.getByText('External evidence note: unchanged')).toBeVisible();
});

it('provides matching Vietnamese keys and interpolation placeholders', () => {
  expect(Object.keys(viUi).sort()).toEqual(Object.keys(enUi).sort());
  for (const key of Object.keys(enUi) as (keyof typeof enUi)[]) {
    expect(viUi[key].trim()).not.toBe('');
    expect(viUi[key].match(/\{\w+\}/g)?.sort() ?? []).toEqual(
      enUi[key].match(/\{\w+\}/g)?.sort() ?? [],
    );
  }
});
