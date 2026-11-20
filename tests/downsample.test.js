import assert from 'node:assert/strict';
import { test } from 'node:test';
import { downsample } from '../api/_lib/downsample.js';

test('returns the input untouched when it is already small enough', () => {
  const items = [1, 2, 3];
  assert.equal(downsample(items, 5), items);
});

test('reduces to the requested size while keeping the first and last items', () => {
  const items = Array.from({ length: 1000 }, (_, index) => index);
  const result = downsample(items, 50);
  assert.equal(result.length, 50);
  assert.equal(result[0], 0);
  assert.equal(result.at(-1), 999);
  assert.deepEqual([...result].sort((a, b) => a - b), result);
});
