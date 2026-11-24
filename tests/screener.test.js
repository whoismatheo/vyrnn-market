import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PAGE_SIZE, filterCoins, findInvertedRange, paginate, sortCoins } from '../api/_lib/screener.js';

const coin = (id, rank, price, marketCap, volume24h, change24h, name = id) => ({ id, name, symbol: id.slice(0, 3), rank, price, marketCap, volume24h, change24h });

const coins = [
  coin('bitcoin', 1, 90000, 1.8e12, 4e10, -1.2, 'Bitcoin'),
  coin('ethereum', 2, 3000, 3.6e11, 2e10, 0.8, 'Ethereum'),
  coin('solana', 6, 140, 7.8e10, 4e9, 7.9, 'Solana'),
  coin('dogecoin', 8, 0.16, 2.5e10, 3e9, -6.2, 'Dogecoin'),
  coin('newcoin', 300, null, null, 5e5, null, 'New Coin'),
];
const ids = (list) => list.map((item) => item.id);

test('filters by each range independently and inclusively', () => {
  assert.deepEqual(ids(filterCoins(coins, { ranges: { price: { min: 140 } } })), ['bitcoin', 'ethereum', 'solana']);
  assert.deepEqual(ids(filterCoins(coins, { ranges: { price: { max: 140 } } })), ['solana', 'dogecoin']);
  assert.deepEqual(ids(filterCoins(coins, { ranges: { marketCap: { min: 2.5e10, max: 3.6e11 } } })), ['ethereum', 'solana', 'dogecoin']);
  assert.deepEqual(ids(filterCoins(coins, { ranges: { marketCap: { min: 7.8e10, max: 7.8e10 } } })), ['solana']);
  assert.deepEqual(ids(filterCoins(coins, { ranges: { volume: { min: 3e9, max: 2e10 } } })), ['ethereum', 'solana', 'dogecoin']);
  assert.deepEqual(ids(filterCoins(coins, { ranges: { change: { min: 0 } } })), ['ethereum', 'solana']);
  assert.deepEqual(ids(filterCoins(coins, { ranges: { change: { max: -1.2 } } })), ['bitcoin', 'dogecoin']);
  assert.deepEqual(ids(filterCoins(coins, { ranges: { rank: { min: 2, max: 6 } } })), ['ethereum', 'solana']);
});

test('combines filters and search with AND semantics', () => {
  const ranges = { change: { min: -10, max: 10 }, marketCap: { min: 1e10 } };
  assert.deepEqual(ids(filterCoins(coins, { ranges })), ['bitcoin', 'ethereum', 'solana', 'dogecoin']);
  assert.deepEqual(ids(filterCoins(coins, { ranges: { ...ranges, change: { min: 0 } } })), ['ethereum', 'solana']);
  assert.deepEqual(ids(filterCoins(coins, { q: 'o', ranges })), ['bitcoin', 'solana', 'dogecoin']);
  assert.deepEqual(ids(filterCoins(coins, { q: 'SOL', ranges })), ['solana']);
  assert.deepEqual(ids(filterCoins(coins, { q: 'zzz', ranges: {} })), []);
});

test('searches names and symbols', () => {
  assert.deepEqual(ids(filterCoins(coins, { q: 'new coin', ranges: {} })), ['newcoin']);
  assert.deepEqual(ids(filterCoins(coins, { q: 'dog', ranges: {} })), ['dogecoin']);
});

test('assets with an unknown value never match a filter on that value', () => {
  assert.deepEqual(ids(filterCoins(coins, { ranges: { price: { min: 0 } } })), ['bitcoin', 'ethereum', 'solana', 'dogecoin']);
  assert.deepEqual(ids(filterCoins(coins, { ranges: { change: { min: -100 } } })), ['bitcoin', 'ethereum', 'solana', 'dogecoin']);
  assert.deepEqual(ids(filterCoins(coins, { ranges: { marketCap: { max: 1e15 } } })).includes('newcoin'), false);
  assert.deepEqual(ids(filterCoins(coins, { ranges: {} })), ids(coins));
});

test('sorts every key in both directions with unknown values last', () => {
  assert.deepEqual(ids(sortCoins(coins, 'rank', 'asc')), ['bitcoin', 'ethereum', 'solana', 'dogecoin', 'newcoin']);
  assert.deepEqual(ids(sortCoins(coins, 'price', 'desc')), ['bitcoin', 'ethereum', 'solana', 'dogecoin', 'newcoin']);
  assert.deepEqual(ids(sortCoins(coins, 'price', 'asc')), ['dogecoin', 'solana', 'ethereum', 'bitcoin', 'newcoin']);
  assert.deepEqual(ids(sortCoins(coins, 'marketCap', 'asc')).at(-1), 'newcoin');
  assert.deepEqual(ids(sortCoins(coins, 'volume', 'desc')), ['bitcoin', 'ethereum', 'solana', 'dogecoin', 'newcoin']);
  assert.deepEqual(ids(sortCoins(coins, 'change', 'desc')), ['solana', 'ethereum', 'bitcoin', 'dogecoin', 'newcoin']);
  assert.deepEqual(ids(sortCoins(coins, 'change', 'asc')), ['dogecoin', 'bitcoin', 'ethereum', 'solana', 'newcoin']);
});

test('ties are broken by rank and the input is not mutated', () => {
  const tied = [coin('b', 2, 5, 1, 1, 1), coin('a', 1, 5, 1, 1, 1)];
  assert.deepEqual(ids(sortCoins(tied, 'price', 'desc')), ['a', 'b']);
  assert.deepEqual(ids(tied), ['b', 'a']);
});

test('paginates and reports totals', () => {
  const many = Array.from({ length: 120 }, (_, i) => coin(`c${i}`, i + 1, 1, 1, 1, 1));
  const first = paginate(many, 1);
  assert.equal(first.coins.length, PAGE_SIZE);
  assert.equal(first.total, 120);
  assert.equal(first.pages, 3);
  assert.equal(paginate(many, 3).coins.length, 20);
  assert.deepEqual(paginate(many, 4).coins, []);
  assert.deepEqual(paginate([], 1), { coins: [], total: 0, pages: 0 });
});

test('detects inverted ranges', () => {
  assert.equal(findInvertedRange({ price: { min: 5, max: 1 } }), 'price');
  assert.equal(findInvertedRange({ price: { min: 1, max: 1 }, rank: { min: 1 } }), null);
  assert.equal(findInvertedRange({}), null);
});
