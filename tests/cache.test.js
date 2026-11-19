import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCache } from '../api/_lib/cache.js';

function clock(start = 1_000) {
  let time = start;
  return { now: () => time, advance: (ms) => (time += ms) };
}

test('returns fresh values inside the ttl', () => {
  const time = clock();
  const cache = createCache({ now: time.now });
  cache.set('a', 1, { ttlMs: 100 });
  assert.deepEqual(cache.get('a'), { value: 1, fresh: true });
});

test('marks values stale after the ttl and drops them after the stale window', () => {
  const time = clock();
  const cache = createCache({ now: time.now });
  cache.set('a', 1, { ttlMs: 100, staleMs: 200 });

  time.advance(150);
  assert.deepEqual(cache.get('a'), { value: 1, fresh: false });

  time.advance(150);
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.size, 0);
});

test('evicts the least recently used entry beyond the limit', () => {
  const cache = createCache({ maxEntries: 2 });
  cache.set('a', 1, { ttlMs: 1000 });
  cache.set('b', 2, { ttlMs: 1000 });
  cache.get('a');
  cache.set('c', 3, { ttlMs: 1000 });

  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('a').value, 1);
  assert.equal(cache.get('c').value, 3);
});

test('overwrites an existing key', () => {
  const cache = createCache();
  cache.set('a', 1, { ttlMs: 1000 });
  cache.set('a', 2, { ttlMs: 1000 });
  assert.equal(cache.get('a').value, 2);
  assert.equal(cache.size, 1);
});
