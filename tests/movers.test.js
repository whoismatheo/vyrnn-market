import assert from 'node:assert/strict';
import { test } from 'node:test';
import { topMovers } from '../src/utils/movers.js';

const coin = (id, change24h) => ({ id, change24h });

test('ranks gainers from highest and losers from lowest', () => {
  const coins = [coin('a', 3), coin('b', -8), coin('c', 12), coin('d', -1), coin('e', 0.4), coin('f', -20)];
  const { gainers, losers } = topMovers(coins, 2);
  assert.deepEqual(gainers.map((c) => c.id), ['c', 'a']);
  assert.deepEqual(losers.map((c) => c.id), ['f', 'b']);
});

test('ignores assets without a measured change and never mixes directions', () => {
  const { gainers, losers } = topMovers([coin('a', null), coin('b', 0), coin('c', 2), coin('d', undefined)], 5);
  assert.deepEqual(gainers.map((c) => c.id), ['c']);
  assert.deepEqual(losers, []);
});

test('does not mutate the input', () => {
  const coins = [coin('a', 1), coin('b', 5)];
  topMovers(coins, 1);
  assert.deepEqual(coins.map((c) => c.id), ['a', 'b']);
});
