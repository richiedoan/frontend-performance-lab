import { afterEach, expect, it, vi } from 'vitest';
import type { Page } from '@playwright/test';
import {
  cssControls,
  initializeCssControl,
  installCssControl,
  selectCssControl,
} from './diagnostic-css';

afterEach(() => {
  window.dispatchEvent(new Event('pagehide'));
  document.getElementById('diagnostic-css-control')?.remove();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});
it('defaults to no override and validates named controls and duplicates', () => {
  expect(selectCssControl([])).toEqual({ name: 'none', css: '', args: [] });
  for (const name of Object.keys(cssControls))
    expect(selectCssControl([`--css-control=${name}`]).name).toBe(name);
  expect(() => selectCssControl(['--css-control=anything'])).toThrow();
  expect(() =>
    selectCssControl(['--css-control=none', '--css-control=none']),
  ).toThrow();
  expect(
    selectCssControl(['large-list', '--css-control=table-container-shadow-off'])
      .args,
  ).toEqual(['large-list']);
});
it('registers the init script before caller navigation and preserves exact metadata', async () => {
  const order: string[] = [];
  const page = {
    exposeBinding: vi.fn(async () => {
      order.push('binding');
    }),
    addInitScript: vi.fn(async () => {
      order.push('init');
    }),
    goto: vi.fn(async () => {
      order.push('navigation');
    }),
  } as unknown as Page;
  const control = selectCssControl([
    '--css-control=table-container-shadow-off',
  ]);
  await installCssControl(page, control, () => {});
  await page.goto('/baseline');
  expect(order).toEqual(['binding', 'init', 'navigation']);
  expect(page.addInitScript).toHaveBeenCalledWith(
    initializeCssControl,
    control,
  );
});
it('installs before application DOM and disconnects observer on pagehide', async () => {
  const emit = vi.fn(async () => {});
  Object.assign(window, { diagnosticCss: emit });
  vi.spyOn(performance, 'mark').mockImplementation(
    () => ({}) as PerformanceMark,
  );
  const control = selectCssControl([
    '--css-control=table-container-radius-off',
  ]);
  initializeCssControl(control);
  expect(document.getElementById('diagnostic-css-control')?.textContent).toBe(
    control.css,
  );
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'installed',
      data: expect.objectContaining({
        beforeApplication: true,
        css: control.css,
      }),
    }),
  );
  window.dispatchEvent(new Event('pagehide'));
  document.body.innerHTML = '<table data-testid="market-row"></table>';
  await Promise.resolve();
  expect(emit).toHaveBeenCalledTimes(1);
  vi.restoreAllMocks();
});
it('does not inject a stylesheet for the control', () => {
  Object.assign(window, { diagnosticCss: vi.fn(async () => {}) });
  vi.spyOn(performance, 'mark').mockImplementation(
    () => ({}) as PerformanceMark,
  );
  initializeCssControl({ name: 'none', css: '' });
  expect(document.getElementById('diagnostic-css-control')).toBeNull();
  vi.restoreAllMocks();
});

it('hides only table image paint while retaining DOM, sources and display', () => {
  Object.assign(window, { diagnosticCss: vi.fn(async () => {}) });
  vi.spyOn(performance, 'mark').mockImplementation(
    () => ({}) as PerformanceMark,
  );
  document.body.innerHTML =
    '<div class="market-table"><img class="market-image" src="fixture.svg" width="64" height="64"><button>Details</button></div><img class="market-image" id="outside" src="fixture.svg">';
  const image = document.querySelector('.market-table img')!;
  const before = image.outerHTML;
  const display = getComputedStyle(image).display;
  initializeCssControl(
    selectCssControl(['--css-control=table-image-paint-off']),
  );
  expect(image.outerHTML).toBe(before);
  expect(document.querySelectorAll('img')).toHaveLength(2);
  expect(getComputedStyle(image).visibility).toBe('hidden');
  expect(getComputedStyle(image).display).toBe(display);
  expect(
    getComputedStyle(document.getElementById('outside')!).visibility,
  ).not.toBe('hidden');
  expect(
    getComputedStyle(document.querySelector('button')!).visibility,
  ).not.toBe('hidden');
  vi.restoreAllMocks();
});
