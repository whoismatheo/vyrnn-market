import { readStorage, writeStorage } from '../utils/storage.js';

export const STORAGE_KEY = 'vyrnn.watchlist';
const MAX_ASSETS = 50;

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const MAX_ID_LENGTH = 100;

function parseStoredIds(raw, max) {
  try {
    const ids = JSON.parse(raw)?.ids;
    if (!Array.isArray(ids)) return [];
    const valid = ids.filter((id) => typeof id === 'string' && id.length <= MAX_ID_LENGTH && ID_PATTERN.test(id));
    return [...new Set(valid)].slice(0, max);
  } catch {
    return [];
  }
}

export function createWatchlist({ storage, events = null, max = MAX_ASSETS, key = STORAGE_KEY }) {
  let ids = parseStoredIds(storage.read(key), max);
  const listeners = new Set();

  function notify() {
    for (const listener of listeners) listener([...ids]);
  }

  function persist() {
    return storage.write(key, JSON.stringify({ version: 1, ids }));
  }

  events?.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== key) return;
    ids = parseStoredIds(storage.read(key), max);
    notify();
  });

  function add(id) {
    if (typeof id !== 'string' || id.length > MAX_ID_LENGTH || !ID_PATTERN.test(id)) return { ok: false, reason: 'invalid' };
    if (ids.includes(id)) return { ok: true, persisted: true };
    if (ids.length >= max) return { ok: false, reason: 'full' };

    ids = [...ids, id];
    const persisted = persist();
    notify();
    return { ok: true, persisted };
  }

  function remove(id) {
    if (!ids.includes(id)) return { persisted: true };
    ids = ids.filter((saved) => saved !== id);
    const persisted = persist();
    notify();
    return { persisted };
  }

  function toggle(id) {
    if (ids.includes(id)) return { watched: false, full: false, ...remove(id) };
    const result = add(id);
    return { watched: result.ok, full: result.reason === 'full', persisted: result.persisted ?? true };
  }

  return {
    max,
    list: () => [...ids],
    has: (id) => ids.includes(id),
    add,
    remove,
    toggle,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const watchlist = createWatchlist({
  storage: { read: readStorage, write: writeStorage },
  events: typeof window === 'undefined' ? null : window,
});
