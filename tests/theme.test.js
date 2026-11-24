import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { THEME_KEY, createThemeController, resolveTheme } from '../src/state/theme.js';

function setup({ stored = null, dark = false, failWrites = false } = {}) {
  const data = new Map(stored === null ? [] : [[THEME_KEY, stored]]);
  const media = Object.assign(new EventTarget(), { matches: dark });
  const root = { dataset: {} };
  const meta = { content: '', setAttribute(name, value) { this.content = value; } };
  const storage = { read: (key) => data.get(key) ?? null, write: (key, value) => (failWrites ? false : (data.set(key, value), true)) };
  return { data, media, root, meta, controller: createThemeController({ storage, media, root, meta }) };
}

test('resolves explicit preferences and the system preference', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
});

test('defaults to the system preference and applies it to the document', () => {
  const light = setup({ dark: false });
  assert.deepEqual([light.controller.getPreference(), light.root.dataset.theme, light.root.dataset.themePreference], ['system', 'light', 'system']);
  const dark = setup({ dark: true });
  assert.deepEqual([dark.root.dataset.theme, dark.meta.content], ['dark', '#0d0f12']);
});

test('restores a stored preference and ignores invalid stored values', () => {
  assert.equal(setup({ stored: 'dark', dark: false }).root.dataset.theme, 'dark');
  assert.equal(setup({ stored: 'light', dark: true }).root.dataset.theme, 'light');
  for (const stored of ['blue', '', 'DARK', '{}']) assert.equal(setup({ stored, dark: true }).controller.getPreference(), 'system');
});

test('switching preference updates the document, persists and notifies', () => {
  const { controller, root, data, meta } = setup({ dark: false });
  const seen = [];
  controller.subscribe((change) => seen.push(change));
  assert.equal(controller.setPreference('dark'), true);
  assert.equal(root.dataset.theme, 'dark');
  assert.equal(data.get(THEME_KEY), 'dark');
  assert.equal(meta.content, '#0d0f12');
  controller.setPreference('light');
  assert.equal(meta.content, '#e9ebed');
  assert.deepEqual(seen, [{ preference: 'dark', theme: 'dark' }, { preference: 'light', theme: 'light' }]);
});

test('rejects unknown preferences', () => {
  const { controller, root } = setup();
  assert.equal(controller.setPreference('sepia'), false);
  assert.equal(root.dataset.theme, 'light');
});

test('system mode follows operating system changes, explicit modes ignore them', () => {
  const system = setup({ dark: false });
  system.media.matches = true;
  system.media.dispatchEvent(new Event('change'));
  assert.equal(system.root.dataset.theme, 'dark');
  system.media.matches = false;
  system.media.dispatchEvent(new Event('change'));
  assert.equal(system.root.dataset.theme, 'light');

  const fixed = setup({ stored: 'light', dark: false });
  fixed.media.matches = true;
  fixed.media.dispatchEvent(new Event('change'));
  assert.equal(fixed.root.dataset.theme, 'light');
});

test('works when storage cannot be written', () => {
  const { controller, root } = setup({ failWrites: true });
  assert.equal(controller.setPreference('dark'), false);
  assert.equal(root.dataset.theme, 'dark');
});

const initScript = readFileSync(new URL('../public/theme-init.js', import.meta.url), 'utf8');

function runInit({ stored, dark, throwing = false, noMatchMedia = false }) {
  const root = { dataset: {} };
  const window = {
    localStorage: { getItem: () => { if (throwing) throw new Error('blocked'); return stored; } },
    matchMedia: noMatchMedia ? undefined : () => ({ matches: dark }),
  };
  vm.runInNewContext(initScript, { window, document: { documentElement: root } });
  return root.dataset;
}

test('the early init script applies the same theme as the controller before rendering', () => {
  assert.deepEqual({ ...runInit({ stored: 'dark', dark: false }) }, { theme: 'dark', themePreference: 'dark' });
  assert.deepEqual({ ...runInit({ stored: 'light', dark: true }) }, { theme: 'light', themePreference: 'light' });
  assert.deepEqual({ ...runInit({ stored: 'system', dark: true }) }, { theme: 'dark', themePreference: 'system' });
  assert.deepEqual({ ...runInit({ stored: null, dark: false }) }, { theme: 'light', themePreference: 'system' });
  assert.deepEqual({ ...runInit({ stored: 'weird', dark: true }) }, { theme: 'dark', themePreference: 'system' });
});

test('the early init script survives blocked storage and missing matchMedia', () => {
  assert.deepEqual({ ...runInit({ throwing: true, dark: true }) }, { theme: 'dark', themePreference: 'system' });
  assert.deepEqual({ ...runInit({ stored: null, noMatchMedia: true }) }, { theme: 'light', themePreference: 'system' });
});
