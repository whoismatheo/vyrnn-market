import { buildScreenerSearch, parseScreener } from '../utils/screener-state.js';
import { readStorage, writeStorage } from '../utils/storage.js';

export const STORAGE_KEY = 'vyrnn.screens';
export const MAX_SAVED = 20;
export const MAX_NAME_LENGTH = 40;

const ID_PATTERN = /^[a-z0-9]{1,24}$/;

function cleanName(value) {
  if (typeof value !== 'string') return null;
  const name = value.replace(/\s+/g, ' ').trim();
  return name.length > 0 && name.length <= MAX_NAME_LENGTH && !/\p{C}/u.test(name) ? name : null;
}

function normalizeSearch(search) {
  return buildScreenerSearch(parseScreener(typeof search === 'string' ? search.slice(0, 600) : ''), { includePage: false });
}

function parseStored(raw, max) {
  try {
    const items = JSON.parse(raw)?.items;
    if (!Array.isArray(items)) return [];

    const seen = new Set();
    const valid = [];
    for (const item of items) {
      const name = cleanName(item?.name);
      if (!name || typeof item.id !== 'string' || !ID_PATTERN.test(item.id) || seen.has(item.id)) continue;
      seen.add(item.id);
      valid.push({ id: item.id, name, search: normalizeSearch(item.search), savedAt: Number.isFinite(item.savedAt) ? item.savedAt : 0 });
    }
    return valid.slice(0, max);
  } catch {
    return [];
  }
}

export function createSavedScreens({ storage, events = null, max = MAX_SAVED, now = Date.now }) {
  let items = parseStored(storage.read(STORAGE_KEY), max);
  let counter = 0;
  const listeners = new Set();

  const notify = () => {
    for (const listener of listeners) listener(items.map((item) => ({ ...item })));
  };

  function persist() {
    return storage.write(STORAGE_KEY, JSON.stringify({ version: 1, items }));
  }

  events?.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    items = parseStored(storage.read(STORAGE_KEY), max);
    notify();
  });

  const nameTaken = (name, ignoreId = null) => items.some((item) => item.id !== ignoreId && item.name.toLowerCase() === name.toLowerCase());

  function save(rawName, search) {
    const name = cleanName(rawName);
    if (!name) return { ok: false, reason: 'invalid' };
    if (nameTaken(name)) return { ok: false, reason: 'duplicate' };
    if (items.length >= max) return { ok: false, reason: 'full' };

    counter += 1;
    const item = { id: `${now().toString(36)}${counter.toString(36)}`.slice(-24), name, search: normalizeSearch(search), savedAt: now() };
    items = [...items, item];
    const persisted = persist();
    notify();
    return { ok: true, item: { ...item }, persisted };
  }

  function rename(id, rawName) {
    const name = cleanName(rawName);
    if (!name) return { ok: false, reason: 'invalid' };
    if (!items.some((item) => item.id === id)) return { ok: false, reason: 'missing' };
    if (nameTaken(name, id)) return { ok: false, reason: 'duplicate' };

    items = items.map((item) => (item.id === id ? { ...item, name } : item));
    const persisted = persist();
    notify();
    return { ok: true, persisted };
  }

  function remove(id) {
    if (!items.some((item) => item.id === id)) return { ok: false, reason: 'missing' };
    items = items.filter((item) => item.id !== id);
    const persisted = persist();
    notify();
    return { ok: true, persisted };
  }

  return {
    max,
    list: () => items.map((item) => ({ ...item })),
    save,
    rename,
    remove,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const savedScreens = createSavedScreens({
  storage: { read: readStorage, write: writeStorage },
  events: typeof window === 'undefined' ? null : window,
});
