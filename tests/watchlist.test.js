import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STORAGE_KEY, createWatchlist } from '../src/state/watchlist.js';

function memoryStorage(initial = {}, { failWrites = false } = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    read: (key) => data.get(key) ?? null,
    write(key, value) {
      if (failWrites) return false;
      data.set(key, value);
      return true;
    },
  };
}

test('starts empty when nothing is stored', () => {
  assert.deepEqual(createWatchlist({ storage: memoryStorage() }).list(), []);
});

test('adds assets in order and ignores duplicates', () => {
  const list = createWatchlist({ storage: memoryStorage() });
  list.add('bitcoin');
  list.add('ethereum');
  list.add('bitcoin');
  assert.deepEqual(list.list(), ['bitcoin', 'ethereum']);
  assert.equal(list.has('ethereum'), true);
  assert.equal(list.has('solana'), false);
});

test('removes assets and tolerates unknown ones', () => {
  const list = createWatchlist({ storage: memoryStorage() });
  list.add('bitcoin');
  list.add('ethereum');
  list.remove('bitcoin');
  list.remove('missing');
  assert.deepEqual(list.list(), ['ethereum']);
});

test('persists across instances sharing the same storage', () => {
  const storage = memoryStorage();
  const first = createWatchlist({ storage });
  first.add('bitcoin');
  first.add('solana');
  first.remove('bitcoin');

  assert.deepEqual(JSON.parse(storage.data.get(STORAGE_KEY)), { version: 1, ids: ['solana'] });
  assert.deepEqual(createWatchlist({ storage }).list(), ['solana']);
});

test('sanitizes corrupted or hostile stored data', () => {
  const cases = [
    'not json',
    '{"ids": "bitcoin"}',
    '{"version": 1}',
    'null',
    JSON.stringify({ ids: ['bitcoin', 'bitcoin', 42, null, '../x', 'Bad Id', '', 'a'.repeat(101), 'ethereum'] }),
  ];
  const results = cases.map((raw) => createWatchlist({ storage: memoryStorage({ [STORAGE_KEY]: raw }) }).list());
  assert.deepEqual(results.slice(0, 4), [[], [], [], []]);
  assert.deepEqual(results[4], ['bitcoin', 'ethereum']);
});

test('truncates stored lists beyond the maximum', () => {
  const ids = Array.from({ length: 10 }, (_, i) => `coin${i}`);
  const list = createWatchlist({ storage: memoryStorage({ [STORAGE_KEY]: JSON.stringify({ ids }) }), max: 3 });
  assert.deepEqual(list.list(), ['coin0', 'coin1', 'coin2']);
});

test('refuses additions beyond the maximum and invalid identifiers', () => {
  const list = createWatchlist({ storage: memoryStorage(), max: 2 });
  assert.equal(list.add('a').ok, true);
  assert.equal(list.add('b').ok, true);
  assert.deepEqual(list.add('c'), { ok: false, reason: 'full' });
  assert.deepEqual(list.add('Not Valid'), { ok: false, reason: 'invalid' });
  assert.deepEqual(list.list(), ['a', 'b']);
});

test('toggle reports the resulting state', () => {
  const list = createWatchlist({ storage: memoryStorage(), max: 1 });
  assert.deepEqual(list.toggle('a'), { watched: true, full: false, persisted: true });
  assert.deepEqual(list.toggle('b'), { watched: false, full: true, persisted: true });
  assert.deepEqual(list.toggle('a'), { watched: false, full: false, persisted: true });
});

test('keeps working in memory and reports when storage is unavailable', () => {
  const list = createWatchlist({ storage: memoryStorage({}, { failWrites: true }) });
  assert.equal(list.add('bitcoin').persisted, false);
  assert.equal(list.toggle('ethereum').persisted, false);
  assert.deepEqual(list.list(), ['bitcoin', 'ethereum']);
});

test('notifies subscribers and stops after unsubscribe', () => {
  const list = createWatchlist({ storage: memoryStorage() });
  const seen = [];
  const unsubscribe = list.subscribe((ids) => seen.push(ids));
  list.add('bitcoin');
  list.remove('bitcoin');
  unsubscribe();
  list.add('ethereum');
  assert.deepEqual(seen, [['bitcoin'], []]);
});

test('follows changes made in another tab through storage events', () => {
  const storage = memoryStorage();
  const events = new EventTarget();
  const list = createWatchlist({ storage, events });
  const seen = [];
  list.subscribe((ids) => seen.push(ids));

  storage.data.set(STORAGE_KEY, JSON.stringify({ version: 1, ids: ['solana'] }));
  events.dispatchEvent(Object.assign(new Event('storage'), { key: STORAGE_KEY }));
  assert.deepEqual(list.list(), ['solana']);

  events.dispatchEvent(Object.assign(new Event('storage'), { key: 'unrelated' }));
  assert.deepEqual(seen, [['solana']]);

  storage.data.clear();
  events.dispatchEvent(Object.assign(new Event('storage'), { key: null }));
  assert.deepEqual(list.list(), []);
});
