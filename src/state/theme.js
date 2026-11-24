import { readStorage, writeStorage } from '../utils/storage.js';

export const THEME_KEY = 'vyrnn.theme';
export const THEME_PREFERENCES = Object.freeze(['light', 'dark', 'system']);

const THEME_COLORS = { light: '#e9ebed', dark: '#0d0f12' };

export function resolveTheme(preference, systemDark) {
  if (preference === 'system') return systemDark ? 'dark' : 'light';
  return preference;
}

export function createThemeController({ storage, media, root, meta = null }) {
  const stored = storage.read(THEME_KEY);
  let preference = THEME_PREFERENCES.includes(stored) ? stored : 'system';
  const listeners = new Set();

  const current = () => resolveTheme(preference, media.matches);

  function apply() {
    const theme = current();
    root.dataset.theme = theme;
    root.dataset.themePreference = preference;
    meta?.setAttribute('content', THEME_COLORS[theme]);
    for (const listener of listeners) listener({ preference, theme });
  }

  media.addEventListener('change', () => {
    if (preference === 'system') apply();
  });

  function setPreference(next) {
    if (!THEME_PREFERENCES.includes(next)) return false;
    preference = next;
    const persisted = storage.write(THEME_KEY, next);
    apply();
    return persisted;
  }

  apply();

  return {
    getPreference: () => preference,
    getTheme: current,
    setPreference,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const themeController =
  typeof window === 'undefined'
    ? null
    : createThemeController({
        storage: { read: readStorage, write: writeStorage },
        media: window.matchMedia('(prefers-color-scheme: dark)'),
        root: document.documentElement,
        meta: document.querySelector('meta[name="theme-color"]'),
      });
