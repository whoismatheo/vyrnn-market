import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../api/_lib/errors.js';
import {
  createChartHandler,
  createGlobalHandler,
  createMarketsHandler,
  createTrendingHandler,
} from '../api/_lib/endpoints.js';
import { createRateLimiter } from '../api/_lib/rate-limit.js';
import { chartPayload, globalPayload, marketCoins, trendingPayload } from './fixtures.js';
import { createRequest, createResponse } from './helpers.js';

const FETCHED_AT = Date.parse('2026-11-19T10:00:00.000Z');

function fakeClient(responses) {
  const calls = [];
  return {
    calls,
    get: async (path, options = {}) => {
      calls.push({ path, params: options.params, ttlMs: options.ttlMs });
      const response = responses[path];
      if (response instanceof Error) throw response;
      return { source: 'upstream', fetchedAt: FETCHED_AT, ...response };
    },
  };
}

async function call(factory, client, url) {
  const handler = factory({ getClient: () => client, limiter: createRateLimiter({ limit: 100, windowMs: 60_000 }) });
  const res = createResponse();
  await handler(createRequest({ url }), res);
  return res;
}

test('global endpoint returns normalized data with freshness metadata', async () => {
  const client = fakeClient({ '/global': { data: globalPayload } });
  const res = await call(createGlobalHandler, client, '/api/global');
  const body = res.json();

  assert.equal(res.statusCode, 200);
  assert.equal(body.data.marketCap, 3_150_000_000_000);
  assert.deepEqual(body.meta, { source: 'upstream', stale: false, updatedAt: '2026-11-19T10:00:00.000Z' });
  assert.equal(res.headers['cache-control'], 'public, max-age=0, s-maxage=60, stale-while-revalidate=120');
  assert.equal(client.calls.length, 1);
});

test('stale provider data is flagged and barely cached at the edge', async () => {
  const client = fakeClient({ '/global': { data: globalPayload, source: 'stale' } });
  const res = await call(createGlobalHandler, client, '/api/global');
  assert.equal(res.json().meta.stale, true);
  assert.equal(res.json().meta.source, 'stale');
  assert.equal(res.headers['cache-control'], 'public, max-age=0, s-maxage=5, stale-while-revalidate=0');
});

test('provider failures become json errors without any substitute data', async () => {
  const client = fakeClient({ '/global': ApiError.upstreamTimeout() });
  const res = await call(createGlobalHandler, client, '/api/global');
  assert.equal(res.statusCode, 504);
  assert.equal(res.json().error.code, 'upstream_timeout');
  assert.equal('data' in res.json(), false);
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('malformed provider payloads are reported as upstream errors', async () => {
  const client = fakeClient({ '/global': { data: { unexpected: true } } });
  const res = await call(createGlobalHandler, client, '/api/global');
  assert.equal(res.statusCode, 502);
  assert.equal(res.json().error.code, 'upstream_error');
});

test('markets endpoint applies defaults and forwards validated parameters', async () => {
  const client = fakeClient({ '/coins/markets': { data: marketCoins } });
  const res = await call(createMarketsHandler, client, '/api/markets');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(
    res.json().data.coins.map((coin) => coin.id),
    ['bitcoin', 'ethereum', 'newcoin'],
  );
  assert.deepEqual(client.calls[0].params, {
    vs_currency: 'usd',
    order: 'market_cap_desc',
    per_page: 50,
    page: 1,
    sparkline: true,
  });

  await call(createMarketsHandler, client, '/api/markets?page=3&perPage=10&order=volume_desc');
  assert.deepEqual(client.calls[1].params, {
    vs_currency: 'usd',
    order: 'volume_desc',
    per_page: 10,
    page: 3,
    sparkline: true,
  });
});

test('markets endpoint rejects invalid input before contacting the provider', async () => {
  const client = fakeClient({ '/coins/markets': { data: [] } });
  for (const query of ['page=0', 'page=101', 'perPage=500', 'order=price_asc', 'page=x', 'foo=1', 'page=1&page=2']) {
    const res = await call(createMarketsHandler, client, `/api/markets?${query}`);
    assert.equal(res.statusCode, 400, query);
  }
  assert.equal(client.calls.length, 0);
});

test('chart endpoint requests the matching history range', async () => {
  const client = fakeClient({ '/coins/bitcoin/market_chart': { data: chartPayload } });
  const res = await call(createChartHandler, client, '/api/chart?id=bitcoin');
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().data.points.length, 180);
  assert.deepEqual(client.calls[0].params, { vs_currency: 'usd', days: '7' });
  assert.equal(res.headers['cache-control'], 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');

  const year = await call(createChartHandler, client, '/api/chart?id=bitcoin&days=365');
  assert.equal(client.calls[1].params.days, '365');
  assert.equal(year.headers['cache-control'], 'public, max-age=0, s-maxage=1800, stale-while-revalidate=3600');
});

test('chart endpoint validates the asset id and range', async () => {
  const client = fakeClient({});
  for (const query of ['', 'id=Bitcoin', 'id=../global', 'id=bitcoin&days=2', 'id=bitcoin&days=max', `id=${'a'.repeat(101)}`]) {
    const res = await call(createChartHandler, client, `/api/chart?${query}`);
    assert.equal(res.statusCode, 400, query);
  }
  assert.equal(client.calls.length, 0);
});

test('unknown assets surface as not found', async () => {
  const client = fakeClient({ '/coins/nothing/market_chart': ApiError.notFound() });
  const res = await call(createChartHandler, client, '/api/chart?id=nothing');
  assert.equal(res.statusCode, 404);
});

test('trending endpoint keeps provider order and enriches assets with market data', async () => {
  const client = fakeClient({
    '/search/trending': { data: trendingPayload, fetchedAt: FETCHED_AT },
    '/coins/markets': { data: marketCoins, fetchedAt: FETCHED_AT + 5000 },
  });
  const res = await call(createTrendingHandler, client, '/api/trending');
  const body = res.json();

  assert.deepEqual(
    body.data.coins.map((coin) => coin.id),
    ['bitcoin', 'ethereum'],
  );
  assert.deepEqual(client.calls[1].params.ids, ['solana', 'bitcoin', 'unlisted', 'ethereum']);
  assert.equal(client.calls[1].params.sparkline, false);
  assert.equal(body.meta.updatedAt, '2026-11-19T10:00:00.000Z');
});

test('trending reports stale when any underlying request is stale', async () => {
  const client = fakeClient({
    '/search/trending': { data: trendingPayload },
    '/coins/markets': { data: marketCoins, source: 'stale' },
  });
  const res = await call(createTrendingHandler, client, '/api/trending');
  assert.equal(res.json().meta.stale, true);
});

test('trending with no assets skips the market lookup', async () => {
  const client = fakeClient({ '/search/trending': { data: { coins: [] } } });
  const res = await call(createTrendingHandler, client, '/api/trending');
  assert.deepEqual(res.json().data, { coins: [] });
  assert.equal(client.calls.length, 1);
});

test('all market endpoints reject other methods', async () => {
  const client = fakeClient({});
  for (const factory of [createGlobalHandler, createMarketsHandler, createChartHandler, createTrendingHandler]) {
    const handler = factory({ getClient: () => client, limiter: createRateLimiter({ limit: 10, windowMs: 1000 }) });
    const res = createResponse();
    await handler(createRequest({ method: 'POST', url: '/api/x' }), res);
    assert.equal(res.statusCode, 405);
  }
});

test('markets endpoint can fetch a specific set of assets for the watchlist', async () => {
  const client = fakeClient({ '/coins/markets': { data: marketCoins } });
  const res = await call(createMarketsHandler, client, '/api/markets?ids=ethereum,bitcoin&perPage=5&page=9');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(client.calls[0].params, {
    vs_currency: 'usd',
    order: 'market_cap_desc',
    sparkline: true,
    ids: ['bitcoin', 'ethereum'],
    per_page: 2,
    page: 1,
  });
});

test('markets endpoint limits the number of requested assets', async () => {
  const client = fakeClient({ '/coins/markets': { data: [] } });
  const ids = Array.from({ length: 51 }, (_, i) => `coin${i}`).join(',');
  assert.equal((await call(createMarketsHandler, client, `/api/markets?ids=${ids}`)).statusCode, 400);
  assert.equal(client.calls.length, 0);
});

test('coin endpoint returns the extended market details of one asset', async () => {
  const { createCoinHandler } = await import('../api/_lib/endpoints.js');
  const { coinDetailPayload } = await import('./fixtures.js');
  const client = fakeClient({ '/coins/markets': { data: coinDetailPayload } });
  const res = await call(createCoinHandler, client, '/api/coin?id=bitcoin');
  const body = res.json();

  assert.equal(res.statusCode, 200);
  assert.equal(body.data.coin.id, 'bitcoin');
  assert.equal(body.data.coin.athChange, -27.6);
  assert.deepEqual(client.calls[0].params, {
    vs_currency: 'usd',
    ids: ['bitcoin'],
    per_page: 1,
    sparkline: false,
    price_change_percentage: '7d,30d,1y',
  });
  assert.equal(res.headers['cache-control'], 'public, max-age=0, s-maxage=60, stale-while-revalidate=120');
  assert.equal(body.meta.stale, false);
});

test('coin endpoint reports unknown assets instead of inventing one', async () => {
  const { createCoinHandler } = await import('../api/_lib/endpoints.js');
  const client = fakeClient({ '/coins/markets': { data: [] } });
  const res = await call(createCoinHandler, client, '/api/coin?id=not-a-coin');
  assert.equal(res.statusCode, 404);
  assert.equal(res.json().error.code, 'not_found');
  assert.equal('data' in res.json(), false);
});

test('coin endpoint validates its input and flags stale details', async () => {
  const { createCoinHandler } = await import('../api/_lib/endpoints.js');
  const { coinDetailPayload } = await import('./fixtures.js');
  const client = fakeClient({ '/coins/markets': { data: coinDetailPayload, source: 'stale' } });
  for (const query of ['', 'id=Bitcoin', 'id=a,b', 'id=bitcoin&x=1']) {
    assert.equal((await call(createCoinHandler, client, `/api/coin?${query}`)).statusCode, 400, query);
  }
  assert.equal(client.calls.length, 0);
  const res = await call(createCoinHandler, client, '/api/coin?id=bitcoin');
  assert.equal(res.json().meta.stale, true);
});

test('search endpoint normalizes the query and returns selectable assets', async () => {
  const { createSearchHandler } = await import('../api/_lib/endpoints.js');
  const { searchPayload } = await import('./fixtures.js');
  const client = fakeClient({ '/search': { data: searchPayload } });
  const res = await call(createSearchHandler, client, '/api/search?q=%20BitCoin%20');
  const body = res.json();

  assert.equal(res.statusCode, 200);
  assert.deepEqual(client.calls[0].params, { query: 'bitcoin' });
  assert.deepEqual(body.data.coins.map((coin) => coin.id), ['bitcoin', 'bitcoin-cash', 'unranked-token']);
  assert.equal(res.headers['cache-control'], 'public, max-age=0, s-maxage=600, stale-while-revalidate=1200');
  assert.equal(body.meta.stale, false);
});

test('search endpoint validates input before contacting the provider', async () => {
  const { createSearchHandler } = await import('../api/_lib/endpoints.js');
  const client = fakeClient({ '/search': { data: { coins: [] } } });
  for (const query of ['', 'q=a', `q=${'x'.repeat(41)}`, 'q=a%26b', 'q=bitcoin&limit=5', 'q=bit&q=coin']) {
    assert.equal((await call(createSearchHandler, client, `/api/search?${query}`)).statusCode, 400, query);
  }
  assert.equal(client.calls.length, 0);
});

test('search endpoint reports provider problems without results', async () => {
  const { createSearchHandler } = await import('../api/_lib/endpoints.js');
  const limited = fakeClient({ '/search': ApiError.upstreamRateLimited(30) });
  const res = await call(createSearchHandler, limited, '/api/search?q=bitcoin');
  assert.equal(res.statusCode, 503);
  assert.equal(res.headers['retry-after'], '30');
  assert.equal('data' in res.json(), false);

  const stale = fakeClient({ '/search': { data: { coins: [] }, source: 'stale' } });
  assert.equal((await call(createSearchHandler, stale, '/api/search?q=bitcoin')).json().meta.stale, true);
});

test('new market endpoints are protected by the per-client rate limit', async () => {
  const { createSearchHandler } = await import('../api/_lib/endpoints.js');
  const client = fakeClient({ '/search': { data: { coins: [] } } });
  const handler = createSearchHandler({ getClient: () => client, limiter: createRateLimiter({ limit: 2, windowMs: 60_000 }) });
  const statuses = [];
  for (let i = 0; i < 3; i += 1) {
    const res = createResponse();
    await handler(createRequest({ url: '/api/search?q=bitcoin' }), res);
    statuses.push(res.statusCode);
  }
  assert.deepEqual(statuses, [200, 200, 429]);
  assert.equal(client.calls.length, 2);
});

const universe = (offset = 0, count = 250) =>
  Array.from({ length: count }, (_, i) => ({
    id: `coin-${offset + i + 1}`,
    symbol: `c${offset + i + 1}`,
    name: `Coin ${offset + i + 1}`,
    current_price: 1000 / (offset + i + 1),
    market_cap: 1e12 / (offset + i + 1),
    market_cap_rank: offset + i + 1,
    total_volume: 1e9 / (offset + i + 1),
    price_change_percentage_24h: ((offset + i) % 21) - 10,
  }));

function universeClient({ pages = 1, failPage = null } = {}) {
  const calls = [];
  return {
    calls,
    get: async (path, options = {}) => {
      calls.push({ path, params: options.params, ttlMs: options.ttlMs });
      const page = options.params.page;
      if (failPage === page) throw ApiError.upstreamTimeout();
      return { source: 'upstream', fetchedAt: FETCHED_AT, data: universe((page - 1) * 250) };
    },
  };
}

test('screener scans the top 250 assets with one provider request and sorts by rank by default', async () => {
  const { createScreenerHandler } = await import('../api/_lib/endpoints.js');
  const client = universeClient();
  const res = await call(createScreenerHandler, client, '/api/screener');
  const { data, meta } = res.json();

  assert.equal(res.statusCode, 200);
  assert.equal(client.calls.length, 1);
  assert.deepEqual(client.calls[0].params, { vs_currency: 'usd', order: 'market_cap_desc', per_page: 250, page: 1, sparkline: false });
  assert.equal(data.total, 250);
  assert.equal(data.scanned, 250);
  assert.equal(data.complete, true);
  assert.equal(data.coins.length, 50);
  assert.equal(data.coins[0].id, 'coin-1');
  assert.equal(data.pages, 5);
  assert.equal(meta.stale, false);
  assert.equal(res.headers['cache-control'], 'public, max-age=0, s-maxage=120, stale-while-revalidate=240');
});

test('screener applies combined filters, search, sort and pagination server-side', async () => {
  const { createScreenerHandler } = await import('../api/_lib/endpoints.js');
  const client = universeClient();
  const res = await call(createScreenerHandler, client, '/api/screener?minCap=1e0&minChange=5&maxChange=10&minRank=20&maxRank=120&sort=change&dir=desc');
  assert.equal(res.statusCode, 400, 'scientific notation is rejected');

  const ok = await call(createScreenerHandler, client, '/api/screener?minChange=5&maxChange=10&minRank=20&maxRank=120&maxPrice=40&sort=price&dir=asc&page=1');
  const { data } = ok.json();
  assert.equal(ok.statusCode, 200);
  assert.ok(data.total > 0);
  assert.ok(data.coins.every((c) => c.change24h >= 5 && c.change24h <= 10 && c.rank >= 20 && c.rank <= 120 && c.price <= 40));
  assert.deepEqual(data.coins.map((c) => c.price), [...data.coins.map((c) => c.price)].sort((a, b) => a - b));

  const searched = await call(createScreenerHandler, client, '/api/screener?q=coin%2012&sort=marketCap&dir=desc');
  assert.deepEqual(searched.json().data.coins.map((c) => c.id), ['coin-12', 'coin-120', 'coin-121', 'coin-122', 'coin-123', 'coin-124', 'coin-125', 'coin-126', 'coin-127', 'coin-128', 'coin-129'].slice(0, searched.json().data.coins.length));
  assert.equal(client.calls.length, 1 + 1, 'the cached universe is requested once per call, never once per filter');
});

test('screener requests more provider pages only when a deeper scan is chosen', async () => {
  const { createScreenerHandler } = await import('../api/_lib/endpoints.js');
  const client = universeClient();
  const res = await call(createScreenerHandler, client, '/api/screener?depth=1000');
  assert.equal(client.calls.length, 4);
  assert.deepEqual(client.calls.map((c) => c.params.page).sort(), [1, 2, 3, 4]);
  assert.equal(res.json().data.scanned, 1000);
  assert.equal(res.json().data.pages, 20);
});

test('screener passes the category to the provider and keeps filtering locally', async () => {
  const { createScreenerHandler } = await import('../api/_lib/endpoints.js');
  const client = universeClient();
  await call(createScreenerHandler, client, '/api/screener?category=layer-1&minChange=0');
  assert.equal(client.calls[0].params.category, 'layer-1');
  assert.equal(client.calls.length, 1);
});

test('screener reports a partial scan when later provider pages fail', async () => {
  const { createScreenerHandler } = await import('../api/_lib/endpoints.js');
  const res = await call(createScreenerHandler, universeClient({ failPage: 3 }), '/api/screener?depth=1000');
  const { data } = res.json();
  assert.equal(res.statusCode, 200);
  assert.equal(data.complete, false);
  assert.equal(data.scanned, 750);
});

test('screener fails without data when the first provider page fails', async () => {
  const { createScreenerHandler } = await import('../api/_lib/endpoints.js');
  const res = await call(createScreenerHandler, universeClient({ failPage: 1 }), '/api/screener?depth=500');
  assert.equal(res.statusCode, 504);
  assert.equal('data' in res.json(), false);
});

test('screener flags stale data from any provider page', async () => {
  const { createScreenerHandler } = await import('../api/_lib/endpoints.js');
  const client = {
    calls: [],
    get: async (path, options) => ({ source: options.params.page === 2 ? 'stale' : 'upstream', fetchedAt: FETCHED_AT, data: universe((options.params.page - 1) * 250) }),
  };
  const res = await call(createScreenerHandler, client, '/api/screener?depth=500');
  assert.equal(res.json().meta.stale, true);
  assert.equal(res.headers['cache-control'], 'public, max-age=0, s-maxage=5, stale-while-revalidate=0');
});

test('screener validates every parameter before contacting the provider', async () => {
  const { createScreenerHandler } = await import('../api/_lib/endpoints.js');
  const client = universeClient();
  const invalid = [
    'q=a%26b', `q=${'x'.repeat(41)}`, 'category=Bad%20Id', 'sort=name', 'dir=up', 'depth=300', 'page=0', 'page=101',
    'minPrice=-1', 'maxPrice=1000000001', 'minCap=abc', 'maxVolume=1e9', 'minChange=-101', 'maxChange=100001',
    'minRank=0', 'maxRank=1001', 'minRank=1.5', 'foo=1', 'minPrice=5&minPrice=6',
    'minPrice=10&maxPrice=5', 'minCap=5&maxCap=4', 'minVolume=5&maxVolume=4', 'minChange=5&maxChange=-5', 'minRank=50&maxRank=10',
  ];
  for (const query of invalid) {
    const res = await call(createScreenerHandler, client, `/api/screener?${query}`);
    assert.equal(res.statusCode, 400, query);
  }
  assert.equal(client.calls.length, 0);
});

test('screener boundary values are accepted and inclusive', async () => {
  const { createScreenerHandler } = await import('../api/_lib/endpoints.js');
  const client = universeClient();
  const res = await call(createScreenerHandler, client, '/api/screener?minRank=1&maxRank=1&minChange=-100&maxChange=100000&minPrice=0&maxPrice=1000000000');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json().data.coins.map((c) => c.id), ['coin-1']);
});

test('screener results beyond the last page are empty but keep the totals', async () => {
  const { createScreenerHandler } = await import('../api/_lib/endpoints.js');
  const res = await call(createScreenerHandler, universeClient(), '/api/screener?page=50');
  assert.deepEqual(res.json().data.coins, []);
  assert.equal(res.json().data.total, 250);
});

test('screener is protected by the per-client rate limit', async () => {
  const { createScreenerHandler } = await import('../api/_lib/endpoints.js');
  const client = universeClient();
  const handler = createScreenerHandler({ getClient: () => client, limiter: createRateLimiter({ limit: 2, windowMs: 60_000 }) });
  const statuses = [];
  for (let i = 0; i < 3; i += 1) {
    const res = createResponse();
    await handler(createRequest({ url: '/api/screener' }), res);
    statuses.push(res.statusCode);
  }
  assert.deepEqual(statuses, [200, 200, 429]);
});

test('categories endpoint returns live provider categories with long caching and stale fallback', async () => {
  const { createCategoriesHandler } = await import('../api/_lib/endpoints.js');
  const calls = [];
  const client = {
    get: async (path, options) => {
      calls.push({ path, options });
      return { source: 'stale', fetchedAt: FETCHED_AT, data: [{ id: 'layer-1', name: 'Layer 1', market_cap: 5 }, { id: 'gaming', name: 'Gaming', market_cap: 2 }] };
    },
  };
  const res = await call(createCategoriesHandler, client, '/api/categories');
  assert.equal(calls[0].path, '/coins/categories');
  assert.equal(calls[0].options.ttlMs, 3_600_000);
  assert.equal(calls[0].options.staleMs, 86_400_000);
  assert.deepEqual(res.json().data.categories.map((c) => c.id), ['layer-1', 'gaming']);
  assert.equal(res.json().meta.stale, true);
  assert.equal((await call(createCategoriesHandler, client, '/api/categories?x=1')).statusCode, 400);
});

test('categories endpoint reports provider failures without inventing categories', async () => {
  const { createCategoriesHandler } = await import('../api/_lib/endpoints.js');
  const res = await call(createCategoriesHandler, fakeClient({ '/coins/categories': ApiError.upstreamRateLimited(20) }), '/api/categories');
  assert.equal(res.statusCode, 503);
  assert.equal('data' in res.json(), false);
});
