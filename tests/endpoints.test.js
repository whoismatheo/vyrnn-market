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
