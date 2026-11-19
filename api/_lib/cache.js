export function createCache({ maxEntries = 500, now = Date.now } = {}) {
  const entries = new Map();

  function get(key) {
    const entry = entries.get(key);
    if (!entry) return undefined;

    const time = now();
    if (time >= entry.staleUntil) {
      entries.delete(key);
      return undefined;
    }

    entries.delete(key);
    entries.set(key, entry);
    return { value: entry.value, fresh: time < entry.expiresAt };
  }

  function set(key, value, { ttlMs, staleMs = 0 }) {
    const time = now();
    entries.delete(key);
    entries.set(key, { value, expiresAt: time + ttlMs, staleUntil: time + ttlMs + staleMs });
    while (entries.size > maxEntries) {
      entries.delete(entries.keys().next().value);
    }
  }

  return {
    get,
    set,
    clear: () => entries.clear(),
    get size() {
      return entries.size;
    },
  };
}
