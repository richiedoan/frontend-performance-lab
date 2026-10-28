import type { ReactElement } from 'react';
import { TranslationProvider } from '../i18n/useTranslation';
import { LanguageSelect } from '../i18n/LanguageSelect';
import { getCaseStudyRecords } from '../experiments/data/catalog/case-study-records';
import { summarizeCaseStudy } from '../experiments/data/summaries/case-study';
import { loadMarket as baselineLoad } from '../features/market/baseline/load-market';
import { loadMarket as optimizedLoad } from '../features/market/optimized/load-market';
import {
  fireEvent,
  render as renderComponent,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BaselinePage from './baseline/page';
import OptimizedPage from './optimized/page';
import CaseStudyPage from './case-study/page';
import HomePage from './page';
import {
  parseScenarioConfig,
  SCENARIOS,
} from '../features/market/config/scenario-config';

function render(ui: ReactElement) {
  return renderComponent(ui, {
    wrapper: ({ children }) => (
      <TranslationProvider>
        <LanguageSelect />
        {children}
      </TranslationProvider>
    ),
  });
}

const navigation = vi.hoisted(() => ({ query: 'count=0', push: vi.fn() }));
beforeEach(() => {
  navigation.query = 'count=0';
  vi.clearAllMocks();
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => new URLSearchParams(navigation.query),
}));
vi.mock('../features/market/baseline/load-market', () => ({
  loadMarket: vi.fn().mockResolvedValue({
    records: [],
    summary: {
      totalRecords: 0,
      totalVolume: 0,
      averagePrice: null,
      averageChange: null,
    },
  }),
}));
vi.mock('../features/market/optimized/load-market', () => ({
  loadMarket: vi.fn().mockResolvedValue({
    records: [],
    summary: {
      totalRecords: 0,
      totalVolume: 0,
      averagePrice: null,
      averageChange: null,
    },
  }),
}));

it.each([BaselinePage, OptimizedPage])(
  'mounts a working market entry point',
  async (Page) => {
    render(<Page />);
    expect(
      screen.getByRole('heading', { name: 'Live Market Explorer', level: 1 }),
    ).toBeInTheDocument();
    expect(await screen.findByTestId('market-empty')).toBeVisible();
  },
);

describe('lab pages', () => {
  it('introduces the project, usage, and AI-assisted build in English', () => {
    render(<HomePage />);
    const main = within(screen.getByRole('main'));
    expect(
      main.getByRole('heading', {
        name: 'Frontend Performance Lab',
        level: 1,
      }),
    ).toBeVisible();
    for (const name of [
      'What this project is designed to do',
      'How to use the lab',
      'Building the project',
    ]) {
      expect(main.getByRole('heading', { name, level: 2 })).toBeVisible();
    }
    expect(main.getByText('Built in 3 days with AI support.')).toBeVisible();
    expect(
      main.getByText(
        /Unavailable means there is no result qualified for publication yet/,
      ),
    ).toBeVisible();
    expect(main.getByText('Keeping comparisons fair.')).toBeVisible();
    expect(main.getByText('Isolating each bottleneck.')).toBeVisible();
    expect(main.getByText('Getting lifecycle cleanup right.')).toBeVisible();
    expect(
      main.getByText('Turning observations into credible evidence.'),
    ).toBeVisible();
  });

  it('explains the three explorer roles and links to a modest reference demo', () => {
    render(<HomePage />);
    const roles = within(
      screen.getByRole('region', {
        name: 'Reference, Baseline, and Optimized',
      }),
    );
    for (const name of [
      'Reference: learn the expected behavior',
      'Baseline: inspect the comparison starting point',
      'Optimized: explore a targeted change',
    ]) {
      expect(roles.getByRole('heading', { name, level: 3 })).toBeVisible();
    }
    expect(
      roles.getByText(/Use this as a functional reference/),
    ).toHaveTextContent(/not a speed benchmark/);
    expect(
      roles.getByText(/This is the control implementation/),
    ).toHaveTextContent(
      /intentionally include inefficient work or retained resources/,
    );
    expect(roles.getByText(/This implements the approach/)).toHaveTextContent(
      /does not prove a speedup or reduced memory use/,
    );
    expect(
      roles.getByRole('link', { name: 'Open Reference Explorer' }),
    ).toHaveAttribute('href', '/reference?seed=20260911&count=60');
    expect(
      roles.getByText(/The three explorers serve different purposes/),
    ).toHaveTextContent(
      /Start with Reference.*then compare Baseline and Optimized/,
    );
  });

  it.each([['Case Study', CaseStudyPage]] as const)(
    'identifies the %s route',
    async (name, Page) => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            records: summarizeCaseStudy(getCaseStudyRecords()),
          }),
        ),
      );
      try {
        render(<Page />);
        expect(
          within(screen.getByRole('main')).getByRole('heading', {
            level: 1,
            name,
          }),
        ).toBeInTheDocument();
        expect(
          await screen.findByRole('heading', {
            name: 'Large list',
          }),
        ).toBeVisible();
        expect(
          screen
            .getByRole('navigation', { name: 'Experiments' })
            .querySelectorAll('a'),
        ).toHaveLength(10);
        expect(screen.queryByRole('figure')).not.toBeInTheDocument();
      } finally {
        fetchMock.mockRestore();
      }
    },
  );

  it('explains defaults, isolated optimization, and fair comparisons', () => {
    render(<HomePage />);
    const guide = within(
      screen.getByRole('region', { name: 'How to use the lab' }),
    );
    expect(guide.getByText(/Without query parameters/)).toHaveTextContent(
      /\/baseline and \/optimized use the default scenario/,
    );
    expect(guide.getByText(/Without query parameters/)).toHaveTextContent(
      /does not enable every optimization at once/,
    );
    expect(guide.getByText(/Without query parameters/)).toHaveTextContent(
      /large-list enables virtualization.*memory scenarios.*can still lag/,
    );
    expect(guide.getByText(/experiment to run/)).toHaveTextContent(
      /scenario = experiment to run; seed = reproducible dataset; count = number of records/,
    );
    expect(guide.getByText(/Keep the same scenario/)).toHaveTextContent(
      /Repeat the same actions in the same order/,
    );
    expect(
      guide.getByText(/These links are interactive demos/),
    ).toHaveTextContent(/not benchmark profiles/);
    expect(guide.getByRole('link', { name: 'Case Study' })).toHaveAttribute(
      'href',
      '/case-study',
    );
  });

  it('offers exactly one valid demo pair per supported scenario', () => {
    render(<HomePage />);
    const list = screen.getByRole('list', { name: 'Scenario demos' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(SCENARIOS.length);
    for (const [index, scenario] of SCENARIOS.entries()) {
      const item = within(items[index]);
      const name = item.getByRole('heading', { level: 3 }).textContent;
      expect(item.getByText(/Try:/)).toBeVisible();
      const links = ['baseline', 'optimized'].map((variant) =>
        item.getByRole('link', {
          name: `Open ${variant}: ${name}`,
        }),
      );
      const urls = links.map((link, variantIndex) => {
        const variant = variantIndex === 0 ? 'baseline' : 'optimized';
        const href = link.getAttribute('href')!;
        expect(href.startsWith(`/${variant}?`)).toBe(true);
        expect(link).toHaveTextContent(`Open ${variant}`);
        const url = new URL(href, 'https://example.test');
        expect(url.pathname).toBe(`/${variant}`);
        const parsed = parseScenarioConfig(url.search);
        expect(parsed.status).toBe('valid');
        if (parsed.status !== 'valid') throw new Error(parsed.message);
        const count =
          scenario === 'large-list'
            ? 250
            : scenario === 'image-font-delivery'
              ? 3
              : 60;
        expect(parsed.config).toMatchObject({
          scenario,
          seed: 20260911,
          count,
        });
        expect(url.searchParams.get('scenario')).toBe(scenario);
        expect(url.searchParams.get('seed')).toBe('20260911');
        expect(url.searchParams.get('count')).toBe(String(count));
        expect(url.searchParams.get('aggregationPasses')).toBe(
          scenario === 'worker-aggregation' ? '20' : null,
        );
        expect([...url.searchParams.keys()].sort()).toEqual(
          (scenario === 'worker-aggregation'
            ? ['scenario', 'seed', 'count', 'aggregationPasses']
            : ['scenario', 'seed', 'count']
          ).sort(),
        );
        return url;
      });
      expect(urls[0].search).toBe(urls[1].search);
      expect(parseScenarioConfig(urls[0].search)).toEqual(
        parseScenarioConfig(urls[1].search),
      );
      expect(item.getAllByRole('link')).toHaveLength(
        scenario === 'large-list' ? 4 : 2,
      );
    }
  });

  it('offers a matching full large-list pair with hosting and interaction limits', () => {
    render(<HomePage />);
    const full = within(
      screen.getByRole('group', { name: 'Full 5,000-record workload' }),
    );
    expect(full.getByText(/local or dedicated environment/)).toHaveTextContent(
      /Interactions may be slow.*payload exceeds Vercel Functions’ response size limit/,
    );
    const urls = ['baseline', 'optimized'].map((variant) => {
      const link = full.getByRole('link', {
        name: `Open ${variant}: Large list — Full 5,000-record workload`,
      });
      expect(link).toHaveAttribute(
        'href',
        `/${variant}?scenario=large-list&seed=20260911&count=5000`,
      );
      const url = new URL(link.getAttribute('href')!, 'https://example.test');
      expect(parseScenarioConfig(url.search)).toMatchObject({
        status: 'valid',
        config: { scenario: 'large-list', seed: 20260911, count: 5000 },
      });
      return url;
    });
    expect(full.getAllByRole('link')).toHaveLength(2);
    expect(urls[0].search).toBe(urls[1].search);
  });
});

it.each([
  [BaselinePage, baselineLoad],
  [OptimizedPage, optimizedLoad],
] as const)(
  'validates route config before loading and strips scenario',
  async (Page, loader) => {
    navigation.query = 'scenario=unknown&count=3';
    const { rerender } = render(<Page />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Invalid configuration',
    );
    expect(loader).not.toHaveBeenCalled();
    navigation.query = 'scenario=search-input&seed=42&count=0';
    rerender(<Page />);
    await screen.findByTestId('market-empty');
    expect(loader).toHaveBeenLastCalledWith(
      'seed=42&count=0&delayMs=0&simulateError=false',
      expect.any(AbortSignal),
    );
    expect(screen.getByTestId('scenario-config')).toHaveAttribute(
      'data-scenario',
      'search-input',
    );
  },
);

it.each(SCENARIOS)(
  'selects optimized scenario %s with valid dataset settings',
  async (scenario) => {
    navigation.query =
      'scenario=worker-aggregation&seed=42&count=0&delayMs=100&aggregationPasses=40';
    render(<OptimizedPage />);
    await screen.findByTestId('market-empty');
    const select = screen.getByRole('combobox', { name: 'Scenario' });
    expect(select).toHaveValue('worker-aggregation');
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.getAttribute('value')),
    ).toEqual([...SCENARIOS]);
    fireEvent.change(select, { target: { value: scenario } });
    expect(navigation.push).toHaveBeenCalledTimes(1);
    const [href, options] = navigation.push.mock.calls[0];
    expect(options).toEqual({ scroll: false });
    const url = new URL(href, 'https://example.test');
    expect(url.pathname).toBe('/optimized');
    expect(parseScenarioConfig(url.search)).toMatchObject({
      status: 'valid',
      config: { scenario, seed: 42, count: 0, delayMs: 100 },
    });
    expect(url.searchParams.get('aggregationPasses')).toBe(
      scenario === 'worker-aggregation' ? '40' : null,
    );
  },
);

it('reflects the default scenario in the optimized selector', async () => {
  render(<OptimizedPage />);
  await screen.findByTestId('market-empty');
  expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveValue(
    'default',
  );
});

it('switches all Overview sections and scenario links to Vietnamese and back', () => {
  render(<HomePage />);
  const main = screen.getByRole('main');
  expect(main).toHaveAttribute('lang', 'en');
  const englishLinks = within(main)
    .getAllByRole('link')
    .map((link) => link.getAttribute('href'));
  fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), {
    target: { value: 'vi' },
  });
  expect(main).toHaveAttribute('lang', 'vi');
  expect(screen.getByRole('combobox', { name: 'Ngôn ngữ' })).toHaveValue('vi');
  for (const name of [
    'Mục tiêu của dự án',
    'Reference, Baseline và Optimized',
    'Cách sử dụng lab',
    'Quá trình xây dựng dự án',
  ]) {
    expect(screen.getByRole('heading', { name, level: 2 })).toBeVisible();
  }
  expect(screen.getByText(/Được xây dựng trong 3 ngày/)).toBeVisible();
  expect(screen.getByText(/Khi không có query parameters/)).toHaveTextContent(
    /vẫn có thể lag/,
  );
  expect(
    screen.getByText(
      /Unavailable nghĩa là chưa có kết quả đủ điều kiện công bố/,
    ),
  ).toBeVisible();
  expect(
    screen.getByRole('link', { name: 'Mở Reference Explorer' }),
  ).toHaveAttribute('href', '/reference?seed=20260911&count=60');
  const list = within(screen.getByRole('list', { name: 'Demo theo kịch bản' }));
  const items = list.getAllByRole('listitem');
  expect(items).toHaveLength(SCENARIOS.length);
  for (const [index, item] of items.entries()) {
    const name = within(item).getByRole('heading', { level: 3 }).textContent;
    expect(within(item).getByText(/Thử:/)).toBeVisible();
    expect(
      within(item).getByText(/Demo: \d+ bản ghi · seed 20260911/),
    ).toBeVisible();
    for (const variant of ['baseline', 'optimized']) {
      const link = within(item).getByRole('link', {
        name: `Mở ${variant}: ${name}`,
      });
      const url = new URL(link.getAttribute('href')!, 'https://example.test');
      expect(parseScenarioConfig(url.search)).toMatchObject({
        status: 'valid',
        config: { scenario: SCENARIOS[index] },
      });
    }
  }
  expect(
    screen.getByRole('link', {
      name: 'Mở optimized: Danh sách lớn — Khối lượng đầy đủ 5.000 bản ghi',
    }),
  ).toHaveAttribute(
    'href',
    '/optimized?scenario=large-list&seed=20260911&count=5000',
  );
  expect(
    within(main)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href')),
  ).toEqual(englishLinks);
  fireEvent.change(screen.getByRole('combobox', { name: 'Ngôn ngữ' }), {
    target: { value: 'en' },
  });
  expect(main).toHaveAttribute('lang', 'en');
  expect(
    screen.getByRole('heading', { name: 'How to use the lab' }),
  ).toBeVisible();
  expect(
    screen.getByRole('link', { name: 'Open baseline: Default explorer' }),
  ).toBeVisible();
});

describe('combined optimized explorer', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_OPTIMIZE', '1');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('defaults to a clean optimized explorer with translated copy', async () => {
    render(<OptimizedPage />);
    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveValue(
      'optimized-explorer',
    );
    expect(screen.getByTestId('scenario-config')).toHaveAttribute(
      'data-render-strategy',
      'optimized-virtual-list',
    );
    expect(await screen.findByTestId('market-empty')).toBeVisible();
    expect(
      screen.queryByRole('option', { name: 'Default explorer' }),
    ).not.toBeInTheDocument();
    for (const testId of [
      'detached-dom-diagnostics',
      'interval-experiment',
      'listener-experiment',
      'request-lifecycle',
      'search-diagnostics',
      'image-font-delivery',
      'aggregation-experiment',
    ])
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Comparison note' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Keeps the default explorer interface/),
    ).toBeVisible();
    fireEvent.change(screen.getByRole('combobox', { name: 'Scenario' }), {
      target: { value: 'large-list' },
    });
    expect(navigation.push).toHaveBeenCalledWith(
      '/optimized?count=0&scenario=large-list',
      { scroll: false },
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), {
      target: { value: 'vi' },
    });
    expect(
      screen.getByRole('option', { name: 'Trình khám phá tối ưu' }),
    ).toBeVisible();
    expect(screen.getByText(/Giữ giao diện khám phá mặc định/)).toBeVisible();
  });

  it('keeps explicit scenarios isolated and baseline default unchanged', async () => {
    navigation.query = 'count=0&scenario=large-list';
    const { unmount } = render(<OptimizedPage />);
    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveValue(
      'large-list',
    );
    expect(await screen.findByTestId('market-empty')).toBeVisible();
    expect(
      screen.queryByTestId('detached-dom-diagnostics'),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Scenario' }), {
      target: { value: 'optimized-explorer' },
    });
    expect(navigation.push).toHaveBeenCalledWith(
      '/optimized?count=0&scenario=optimized-explorer',
      { scroll: false },
    );
    unmount();
    navigation.query = 'count=0';
    render(<BaselinePage />);
    expect(screen.getByTestId('scenario-config')).toHaveAttribute(
      'data-scenario',
      'default',
    );
    expect(await screen.findByTestId('market-empty')).toBeVisible();
  });

  it('adds a combined Overview link only when enabled', () => {
    const { unmount } = render(<HomePage />);
    expect(
      screen.queryByRole('heading', { name: 'Default explorer' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open optimized: Optimized Explorer' }),
    ).toHaveAttribute(
      'href',
      '/optimized?scenario=optimized-explorer&seed=20260911&count=250',
    );
    unmount();
    vi.stubEnv('NEXT_PUBLIC_ENABLE_OPTIMIZE', '0');
    render(<HomePage />);
    expect(
      screen.queryByRole('link', {
        name: 'Open optimized: Optimized Explorer',
      }),
    ).not.toBeInTheDocument();
  });

  it('hides the option and rejects its URL when disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_OPTIMIZE', '0');
    navigation.query = 'scenario=optimized-explorer';
    render(<OptimizedPage />);
    expect(screen.getByRole('alert')).toBeVisible();
    expect(optimizedLoad).not.toHaveBeenCalled();
  });
});

it('preserves search diagnostics in the individual search scenario', async () => {
  navigation.query = 'count=0&scenario=search-input';
  render(<OptimizedPage />);
  expect(await screen.findByTestId('market-empty')).toBeVisible();
  expect(screen.getByTestId('search-diagnostics')).toBeInTheDocument();
});

it('places Building the project before the other Overview sections', () => {
  render(<HomePage />);
  expect(screen.getAllByRole('heading', { level: 2 })[0]).toHaveTextContent(
    'Building the project',
  );
});

it('shows the eleven selected build challenges', () => {
  render(<HomePage />);
  const build = within(
    screen.getByRole('region', { name: 'Building the project' }),
  );
  expect(build.getAllByRole('listitem')).toHaveLength(11);
  for (const title of [
    'Rendering large datasets.',
    'Diagnosing timeouts instead of extending deadlines.',
    'Investigating browser rendering stalls.',
    'Keeping end-to-end tests reliable in CI.',
    'Making execution environments reproducible.',
    'Getting validated results into the deployed app.',
    'Working with AI while controlling scope.',
  ])
    expect(build.getByText(title)).toBeVisible();
  expect(build.getByText(/Local diagnostics recorded/)).toHaveTextContent(
    'Docker/CI reproduction remains unverified.',
  );
});
