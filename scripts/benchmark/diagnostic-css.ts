import type { Page } from '@playwright/test';

export const cssControls = {
  none: '',
  'table-image-paint-off':
    '.market-table .market-image { visibility: hidden !important; }',
  'table-button-motion-off':
    '.market-table button { transform: none !important; translate: none !important; scale: none !important; transition: none !important; }',
  'table-button-transition-off':
    '.market-table button { transition: none !important; }',
  'table-container-shadow-off':
    '.market-table-scroll { box-shadow: none !important; }',
  'table-container-radius-off':
    '.market-table-scroll { border-radius: 0 !important; }',
  'table-border-separate':
    '.market-table { border-collapse: separate !important; }',
} as const;
export type CssControl = keyof typeof cssControls;

export function selectCssControl(args: string[]) {
  const flags = args.filter((arg) => arg.startsWith('--css-control='));
  const name = flags[0]?.slice('--css-control='.length) ?? 'none';
  if (flags.length > 1 || !Object.hasOwn(cssControls, name))
    throw new Error('Unknown or duplicate --css-control');
  return {
    name: name as CssControl,
    css: cssControls[name as CssControl],
    args: args.filter((arg) => !flags.includes(arg)),
  };
}

/** Serialized into the diagnostic document; no application handlers or state changes. */
export function initializeCssControl(control: {
  name: CssControl;
  css: string;
}) {
  const emit = (kind: string, data: unknown) => {
    void (
      window as unknown as { diagnosticCss: (value: unknown) => Promise<void> }
    ).diagnosticCss({
      kind,
      timeOrigin: performance.timeOrigin,
      now: performance.now(),
      data,
    });
  };
  const observer = new MutationObserver(install);
  let installed = false;
  function install() {
    if (!installed && document.documentElement) {
      const beforeApplication = !document.querySelector(
        '[data-testid="market-dashboard"]',
      );
      if (control.css) {
        const style = document.createElement('style');
        style.id = 'diagnostic-css-control';
        style.textContent = control.css;
        document.documentElement.append(style);
      }
      installed = true;
      performance.mark('diagnostic:css-installed');
      emit('installed', {
        ...control,
        beforeApplication,
        readyState: document.readyState,
      });
    }
    if (installed && document.querySelector('[data-testid="market-row"]')) {
      observer.disconnect();
      // Compute only a handful of target styles; never mutate the workload DOM.
      const selectors = [
        '.market-table',
        '.market-table-scroll',
        '.market-table button',
        '.market-table .market-image',
        '.lab-layout',
      ];
      const properties = [
        'visibility',
        'display',
        'transform',
        'translate',
        'scale',
        'transition-property',
        'transition-duration',
        'box-shadow',
        'border-radius',
        'overflow-x',
        'overflow-y',
        'border-collapse',
        'border-spacing',
        'will-change',
        'contain',
      ];
      emit(
        'first-table-styles',
        selectors.map((selector) => {
          const element = document.querySelector(selector)!;
          const style = getComputedStyle(element);
          return {
            selector,
            styles: Object.fromEntries(
              properties.map((key) => [key, style.getPropertyValue(key)]),
            ),
          };
        }),
      );
    }
  }
  observer.observe(document, { childList: true, subtree: true });
  install();
  window.addEventListener('pagehide', () => observer.disconnect(), {
    once: true,
  });
}

export async function installCssControl(
  page: Page,
  control: { name: CssControl; css: string },
  persist: (value: unknown) => void,
) {
  await page.exposeBinding('diagnosticCss', (_, value) => persist(value));
  await page.addInitScript(initializeCssControl, control);
}

/** Identical inspection in control and treatment; no scroll, hover, focus or click. */
export function inspectCssWorkload() {
  const properties = [
    'visibility',
    'display',
    'transform',
    'translate',
    'scale',
    'transition-property',
    'transition-duration',
    'box-shadow',
    'border-radius',
    'overflow-x',
    'overflow-y',
    'border-collapse',
    'border-spacing',
    'will-change',
    'contain',
  ];
  const targets = [
    '.market-table',
    '.market-table-scroll',
    '.market-table button',
    '.market-table .market-image',
    '[data-testid="market-detail-market-000001"]',
    '.lab-layout',
  ];
  const images = [
    ...document.querySelectorAll<HTMLImageElement>(
      '.market-table .market-image',
    ),
  ];
  const sources: Record<string, number> = {};
  for (const image of images) {
    const src = image.getAttribute('src') ?? '';
    sources[src] = (sources[src] ?? 0) + 1;
  }
  return {
    timeOrigin: performance.timeOrigin,
    now: performance.now(),
    images: {
      count: images.length,
      sources,
      samples: [0, Math.floor(images.length / 2), images.length - 1]
        .filter((index) => index >= 0 && images[index])
        .map((index) => ({
          index,
          rect: images[index].getBoundingClientRect().toJSON(),
          visibility: getComputedStyle(images[index]).visibility,
        })),
    },
    rows: document.querySelectorAll('[data-testid="market-row"]').length,
    expansions: document.querySelectorAll('[data-testid^="market-expanded-"]')
      .length,
    tableRows: document.querySelectorAll('.market-table tbody tr').length,
    buttons: document.querySelectorAll('.market-table button').length,
    hoverMedia: matchMedia('(hover: hover) and (pointer: fine)').matches,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    targets: targets.map((selector) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return { selector, missing: true };
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        selector,
        styles: Object.fromEntries(
          properties.map((key) => [key, style.getPropertyValue(key)]),
        ),
        rect: rect.toJSON(),
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
        text: element.matches('button') ? element.textContent : null,
        disabled: element.matches(':disabled'),
      };
    }),
  };
}
