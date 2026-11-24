import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STORAGE_KEY, createSavedScreens } from '../src/state/saved-screens.js';

function memoryStorage(initial = {}, { failWrites = false } = {}) {
  const data = new Map(Object.entries(initial));
  return { data, read: (key) => data.get(key) ?? null, write: (key, value) => (failWrites ? false : (data.set(key, value), true)) };
}
const make = (storage = memoryStorage(), options = {}) => createSavedScreens({ storage, now: () => 1_700_000_000_000, ...options });

test('saves a named configuration with a normalized search and no page', () => {
  const screens = make();
  const result = screens.save('  My  filters ', 'minPrice=1&page=4&sort=price&dir=desc&junk=1');
  assert.equal(result.ok, true);
  assert.deepEqual(screens.list().map(({ name, search }) => [name, search]), [['My filters', 'sort=price&minPrice=1']]);
});

test('persists across instances', () => {
  const storage = memoryStorage();
  make(storage).save('Large caps', 'minMarketCap=1000000000');
  assert.deepEqual(make(storage).list().map((item) => item.name), ['Large caps']);
  assert.equal(JSON.parse(storage.data.get(STORAGE_KEY)).version, 1);
});

test('renames, removes and keeps ids stable', () => {
  const screens = make();
  const { item } = screens.save('One', 'q=btc');
  screens.save('Two', 'q=eth');
  assert.equal(screens.rename(item.id, 'Uno').ok, true);
  assert.deepEqual(screens.list().map((i) => i.name), ['Uno', 'Two']);
  assert.equal(screens.list()[0].id, item.id);
  assert.equal(screens.remove(item.id).ok, true);
  assert.deepEqual(screens.list().map((i) => i.name), ['Two']);
});

test('validates names, duplicates and the maximum', () => {
  const screens = make(memoryStorage(), { max: 2 });
  assert.deepEqual(screens.save('', 'q=a'), { ok: false, reason: 'invalid' });
  assert.deepEqual(screens.save('   ', 'q=a'), { ok: false, reason: 'invalid' });
  assert.deepEqual(screens.save('x'.repeat(41), 'q=a'), { ok: false, reason: 'invalid' });
  assert.deepEqual(screens.save('bad\u0000name', 'q=a'), { ok: false, reason: 'invalid' });
  assert.equal(screens.save('Alpha', 'q=a').ok, true);
  assert.deepEqual(screens.save('alpha', 'q=b'), { ok: false, reason: 'duplicate' });
  assert.equal(screens.save('Beta', 'q=b').ok, true);
  assert.deepEqual(screens.save('Gamma', 'q=c'), { ok: false, reason: 'full' });
  const beta = screens.list()[1];
  assert.deepEqual(screens.rename(beta.id, 'ALPHA'), { ok: false, reason: 'duplicate' });
  assert.equal(screens.rename(beta.id, 'Beta').ok, true);
  assert.deepEqual(screens.rename('nope', 'Zed'), { ok: false, reason: 'missing' });
  assert.deepEqual(screens.remove('nope'), { ok: false, reason: 'missing' });
});

test('ignores and repairs invalid or outdated stored data', () => {
  const raw = JSON.stringify({
    items: [
      { id: 'abc123', name: 'Valid', search: 'minPrice=5&maxPrice=1&page=9&evil=1', savedAt: 5 },
      { id: 'abc123', name: 'Duplicate id', search: '' },
      { id: 'Bad Id', name: 'Bad id', search: '' },
      { id: 'good', name: '', search: '' },
      { id: 'good2', name: 'x'.repeat(50), search: '' },
      { id: 'good3', name: 'Garbage search', search: 12345 },
      { name: 'No id' },
      null,
      'text',
    ],
  });
  const screens = make(memoryStorage({ [STORAGE_KEY]: raw }));
  assert.deepEqual(screens.list().map(({ id, name, search }) => [id, name, search]), [
    ['abc123', 'Valid', 'minPrice=1&maxPrice=5'],
    ['good3', 'Garbage search', ''],
  ]);
  for (const bad of ['not json', 'null', '{"items":"x"}', '{}']) assert.deepEqual(make(memoryStorage({ [STORAGE_KEY]: bad })).list(), []);
});

test('bounds the stored list and oversized searches', () => {
  const items = Array.from({ length: 30 }, (_, i) => ({ id: `id${i}`, name: `Name ${i}`, search: `q=${'a'.repeat(900)}` }));
  const screens = make(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ items }) }));
  assert.equal(screens.list().length, 20);
  assert.ok(screens.list().every((item) => item.search.length <= 600));
});

test('reports storage failures but keeps working in memory', () => {
  const screens = make(memoryStorage({}, { failWrites: true }));
  assert.equal(screens.save('Temp', 'q=a').persisted, false);
  assert.equal(screens.list().length, 1);
});

test('notifies subscribers and follows other tabs', () => {
  const storage = memoryStorage();
  const events = new EventTarget();
  const screens = make(storage, { events });
  const seen = [];
  const stop = screens.subscribe((items) => seen.push(items.map((i) => i.name)));
  screens.save('Mine', 'q=a');
  storage.data.set(STORAGE_KEY, JSON.stringify({ version: 1, items: [{ id: 'other1', name: 'Other', search: '' }] }));
  events.dispatchEvent(Object.assign(new Event('storage'), { key: STORAGE_KEY }));
  stop();
  screens.save('After', 'q=b');
  assert.deepEqual(seen, [['Mine'], ['Other']]);
});

test('returned items are copies that cannot mutate the store', () => {
  const screens = make();
  screens.save('Safe', 'q=a');
  screens.list()[0].name = 'Changed';
  assert.equal(screens.list()[0].name, 'Safe');
});
