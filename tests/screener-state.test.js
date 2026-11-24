import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RANGE_FIELDS, activeFilters, buildScreenerSearch, buildScreenerUrl, clearFilters, parseAmount, parseScreener, plainNumber } from '../src/utils/screener-state.js';

const empty = { q: '', category: '', sort: 'rank', dir: 'asc', depth: '250', page: 1, ranges: {} };

test('defaults produce a clean URL', () => {
  assert.deepEqual(parseScreener(''), empty);
  assert.equal(buildScreenerUrl(empty), '/screener');
});

test('round trips every supported parameter', () => {
  const state = {
    q: 'bit coin', category: 'layer-1', sort: 'change', dir: 'asc', depth: '500', page: 3,
    ranges: { price: { min: 0.5, max: 100 }, marketCap: { min: 1e9, max: undefined }, volume: { min: undefined, max: 5e8 }, change: { min: -10, max: 25.5 }, rank: { min: 5, max: 200 } },
  };
  const search = buildScreenerSearch(state);
  assert.deepEqual(parseScreener(search), state);
  assert.equal(search, 'q=bit%20coin&category=layer-1&sort=change&dir=asc&depth=500&minPrice=0.5&maxPrice=100&minMarketCap=1000000000&maxVolume=500000000&minChange=-10&maxChange=25.5&minRank=5&maxRank=200&page=3');
});

test('omits defaults, including the natural direction of each sort', () => {
  assert.equal(buildScreenerSearch({ ...empty, sort: 'price', dir: 'desc' }), 'sort=price');
  assert.equal(buildScreenerSearch({ ...empty, sort: 'price', dir: 'asc' }), 'sort=price&dir=asc');
  assert.equal(buildScreenerSearch({ ...empty, dir: 'desc' }), 'dir=desc');
  assert.equal(parseScreener('sort=volume').dir, 'desc');
  assert.equal(parseScreener('sort=rank').dir, 'asc');
});

test('page is only serialized beyond the first and can be excluded', () => {
  assert.equal(buildScreenerSearch({ ...empty, page: 1 }), '');
  assert.equal(buildScreenerSearch({ ...empty, page: 2 }), 'page=2');
  assert.equal(buildScreenerSearch({ ...empty, page: 2 }, { includePage: false }), '');
});

test('sanitizes malformed and hostile parameters', () => {
  const state = parseScreener('q=%3Cscript%3E&category=Bad%20Id&sort=name&dir=up&depth=999&page=0&minPrice=abc&maxPrice=1e3&minRank=1.5&maxRank=2000&minChange=-101&maxVolume=-1');
  assert.deepEqual(state, empty);
  assert.equal(parseScreener(`q=${'x'.repeat(41)}`).q, '');
  assert.equal(parseScreener(`category=${'a'.repeat(101)}`).category, '');
  assert.equal(parseScreener('page=101').page, 1);
  assert.equal(parseScreener('page=100').page, 100);
});

test('normalizes the search text', () => {
  assert.equal(parseScreener('q=%20%20Bitcoin%20%20CASH').q, 'bitcoin cash');
  assert.equal(parseScreener('q=a%26b').q, '');
});

test('swaps inverted ranges instead of producing empty results', () => {
  assert.deepEqual(parseScreener('minPrice=100&maxPrice=5').ranges.price, { min: 5, max: 100 });
  assert.deepEqual(parseScreener('minRank=50&maxRank=10').ranges.rank, { min: 10, max: 50 });
});

test('accepts boundary values exactly', () => {
  const { ranges } = parseScreener('minRank=1&maxRank=1000&minChange=-100&maxChange=100000&minPrice=0&maxPrice=1000000000');
  assert.deepEqual(ranges.rank, { min: 1, max: 1000 });
  assert.deepEqual(ranges.change, { min: -100, max: 100000 });
  assert.deepEqual(ranges.price, { min: 0, max: 1e9 });
});

test('serializes small and large numbers without exponents', () => {
  assert.equal(plainNumber(0.0000001), '0.0000001');
  assert.equal(plainNumber(1e15), '1000000000000000');
  assert.equal(plainNumber(2.5e9), '2500000000');
  assert.equal(buildScreenerSearch({ ...empty, ranges: { price: { min: 0.0000001, max: undefined } } }), 'minPrice=0.0000001');
});

test('lists active filters and clears them without touching sorting', () => {
  const state = parseScreener('q=eth&category=layer-1&sort=volume&depth=500&minPrice=1&maxRank=50&page=4');
  assert.deepEqual(activeFilters(state), [{ type: 'q' }, { type: 'category' }, { type: 'range', key: 'price' }, { type: 'range', key: 'rank' }]);
  assert.deepEqual(activeFilters(empty), []);
  const cleared = clearFilters(state);
  assert.deepEqual(activeFilters(cleared), []);
  assert.equal(cleared.sort, 'volume');
  assert.equal(cleared.depth, '500');
  assert.equal(cleared.page, 1);
});

test('parses amounts with optional K, M, B and T suffixes', () => {
  const money = RANGE_FIELDS.marketCap;
  assert.equal(parseAmount('1500', money), 1500);
  assert.equal(parseAmount('2.5b', money), 2.5e9);
  assert.equal(parseAmount(' 10M ', money), 1e7);
  assert.equal(parseAmount('3k', RANGE_FIELDS.price), 3000);
  assert.equal(parseAmount('1.2T', money), 1.2e12);
  assert.equal(parseAmount('0', money), 0);
});

test('rejects invalid amounts', () => {
  const money = RANGE_FIELDS.marketCap;
  for (const text of ['', 'abc', '1,000', '1e9', '1 b', '1bb', '-1', '2000t', '.5', '5.', '$5']) assert.equal(parseAmount(text, money), null, text);
  assert.equal(parseAmount('5k', RANGE_FIELDS.change), null);
  assert.equal(parseAmount('-50', RANGE_FIELDS.change), -50);
  assert.equal(parseAmount('-101', RANGE_FIELDS.change), null);
  assert.equal(parseAmount('1.5', RANGE_FIELDS.rank), null);
  assert.equal(parseAmount('1001', RANGE_FIELDS.rank), null);
  assert.equal(parseAmount('25', RANGE_FIELDS.rank), 25);
});
