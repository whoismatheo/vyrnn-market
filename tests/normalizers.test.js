import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  extractTrendingIds,
  normalizeChart,
  normalizeGlobal,
  normalizeMarkets,
  safeImageUrl,
} from '../api/_lib/normalizers.js';
import { chartPayload, globalPayload, marketCoins, trendingPayload } from './fixtures.js';

const upstreamError = (error) => error.code === 'upstream_error' && error.status === 502;

test('normalizes global market statistics', () => {
  assert.deepEqual(normalizeGlobal(globalPayload), {
    marketCap: 3_150_000_000_000,
    volume24h: 121_000_000_000,
    marketCapChange24h: -1.42,
    btcDominance: 57.31,
    ethDominance: 11.84,
    activeCryptocurrencies: 14210,
    updatedAt: new Date(1_763_500_000 * 1000).toISOString(),
  });
});

test('keeps optional global fields as null and rejects payloads without totals', () => {
  const sparse = { data: { total_market_cap: { usd: 1 }, total_volume: { usd: 2 } } };
  const result = normalizeGlobal(sparse);
  assert.equal(result.btcDominance, null);
  assert.equal(result.marketCapChange24h, null);
  assert.equal(result.updatedAt, null);

  assert.throws(() => normalizeGlobal({ data: { total_volume: { usd: 2 } } }), upstreamError);
  assert.throws(() => normalizeGlobal({}), upstreamError);
  assert.throws(() => normalizeGlobal(null), upstreamError);
});

test('normalizes market rows and drops entries without an identity', () => {
  const coins = normalizeMarkets(marketCoins);
  assert.deepEqual(
    coins.map((coin) => coin.id),
    ['bitcoin', 'ethereum', 'newcoin'],
  );

  const [bitcoin, , unlisted] = coins;
  assert.equal(bitcoin.symbol, 'BTC');
  assert.equal(bitcoin.price, 91234.5);
  assert.equal(bitcoin.rank, 1);
  assert.equal(bitcoin.change24h, -1.2345);
  assert.equal(bitcoin.image, 'https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png?1696501400');

  assert.equal(unlisted.price, null);
  assert.equal(unlisted.marketCap, null);
  assert.equal(unlisted.change24h, null);
  assert.equal(unlisted.rank, null);
  assert.equal(unlisted.sparkline, null);
  assert.equal(unlisted.image, null);
});

test('reduces sparklines while preserving their endpoints', () => {
  const [bitcoin] = normalizeMarkets(marketCoins);
  assert.equal(bitcoin.sparkline.length, 32);
  assert.equal(bitcoin.sparkline[0], 100);
  assert.equal(bitcoin.sparkline.at(-1), 100 + 167 * 0.5);
});

test('falls back to the in-currency change field', () => {
  const [coin] = normalizeMarkets([
    { id: 'a', name: 'A', symbol: 'a', price_change_percentage_24h_in_currency: 3.5 },
  ]);
  assert.equal(coin.change24h, 3.5);
});

test('rejects market payloads that are not lists', () => {
  assert.throws(() => normalizeMarkets({ error: 'rate limit' }), upstreamError);
  assert.deepEqual(normalizeMarkets([]), []);
});

test('only accepts https images from CoinGecko hosts', () => {
  assert.ok(safeImageUrl('https://coin-images.coingecko.com/a.png'));
  assert.ok(safeImageUrl('https://assets.coingecko.com/a.png'));
  for (const value of ['http://coin-images.coingecko.com/a.png', 'https://evil.example/a.png', 'javascript:alert(1)', '', null, 42]) {
    assert.equal(safeImageUrl(value), null, String(value));
  }
});

test('normalizes chart points and bounds their number', () => {
  const { points } = normalizeChart(chartPayload);
  assert.equal(points.length, 180);
  assert.deepEqual(points[0], [1_760_000_000_000, 90_000]);
  assert.deepEqual(points.at(-1), [1_760_000_000_000 + 720 * 3_600_000, 90_720]);
});

test('drops malformed chart points and accepts an empty history', () => {
  const { points } = normalizeChart({ prices: [[1, 2], [null, 3], 'x', [4], [5, 6]] });
  assert.deepEqual(points, [[1, 2], [5, 6]]);
  assert.deepEqual(normalizeChart({ prices: [] }), { points: [] });
  assert.throws(() => normalizeChart({}), upstreamError);
});

test('extracts unique trending ids and ignores malformed entries', () => {
  assert.deepEqual(extractTrendingIds(trendingPayload), ['solana', 'bitcoin', 'unlisted', 'ethereum']);
  assert.deepEqual(extractTrendingIds({ coins: [{}, { item: {} }, null] }), []);
  assert.equal(extractTrendingIds({ coins: Array.from({ length: 30 }, (_, i) => ({ item: { id: `c${i}` } })) }).length, 10);
  assert.throws(() => extractTrendingIds({}), upstreamError);
});
