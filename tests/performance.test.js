import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizePerformance, periodChange, startsLate } from '../src/utils/performance.js';
import { nearestIndex } from '../src/utils/series.js';

test('normalizes prices to percentage change from the first point', () => {
  const result = normalizePerformance([[1, 100], [2, 150], [3, 50], [4, 100]]);
  assert.deepEqual(result, [[1, 0, 100], [2, 50, 150], [3, -50, 50], [4, 0, 100]]);
});

test('assets with different price scales become comparable', () => {
  const cheap = normalizePerformance([[1, 0.002], [2, 0.003]]);
  const expensive = normalizePerformance([[1, 90000], [2, 135000]]);
  assert.ok(Math.abs(periodChange(cheap) - periodChange(expensive)) < 1e-9);
});

test('refuses to normalize without a usable starting price', () => {
  assert.deepEqual(normalizePerformance([]), []);
  assert.deepEqual(normalizePerformance([[1, 5]]), []);
  assert.deepEqual(normalizePerformance([[1, 0], [2, 5]]), []);
  assert.deepEqual(normalizePerformance([[1, -3], [2, 5]]), []);
  assert.equal(periodChange([]), null);
});

test('a flat series stays at zero instead of being invented as movement', () => {
  assert.deepEqual(normalizePerformance([[1, 7], [2, 7]]).map(([, pct]) => pct), [0, 0]);
});

test('detects histories that start well after the selected period began', () => {
  const late = normalizePerformance([[500, 1], [1000, 2]]);
  const full = normalizePerformance([[0, 1], [1000, 2]]);
  assert.equal(startsLate(late, 0, 1000), true);
  assert.equal(startsLate(full, 0, 1000), false);
  assert.equal(startsLate([], 0, 1000), false);
});

test('finds the nearest point in time', () => {
  const times = [0, 10, 20, 40];
  assert.equal(nearestIndex(times, -5), 0);
  assert.equal(nearestIndex(times, 4), 0);
  assert.equal(nearestIndex(times, 6), 1);
  assert.equal(nearestIndex(times, 29), 2);
  assert.equal(nearestIndex(times, 31), 3);
  assert.equal(nearestIndex(times, 99), 3);
  assert.equal(nearestIndex([5], 100), 0);
});
