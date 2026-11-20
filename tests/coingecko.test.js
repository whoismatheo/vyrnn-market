import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCache } from '../api/_lib/cache.js';
import { createCoinGeckoClient } from '../api/_lib/coingecko.js';
import { loadConfig } from '../api/_lib/config.js';
import { createFetchMock, jsonResponse } from './helpers.js';

function clock(start = 1_000) {
  let time = start;
  return { now: () => time, advance: (ms) => (time += ms) };
}

function makeClient(responses, { env = {}, time = clock(), config } = {}) {
  const fetchImpl = createFetchMock(responses);
  const client = createCoinGeckoClient({
    config: config ?? loadConfig({ COINGECKO_API_KEY: 'test-key', ...env }).coingecko,
    fetchImpl,
    cache: createCache({ now: time.now }),
    now: time.now,
    sleep: async () => {},
  });
  return { client, fetchImpl, time };
}

const rejects = (promise, code) =>
  assert.rejects(promise, (error) => error.code === code, `expected error code ${code}`);

test('sends the demo key header to the public host and serializes sorted params', async () => {
  const { client, fetchImpl } = makeClient([jsonResponse({ ok: true })]);
  const { data, source } = await client.get('/coins/markets', { params: { vs_currency: 'usd', per_page: 10, skip: undefined } });

  assert.deepEqual(data, { ok: true });
  assert.equal(source, 'upstream');
  assert.equal(fetchImpl.calls[0].url, 'https://api.coingecko.com/api/v3/coins/markets?per_page=10&vs_currency=usd');
  assert.equal(fetchImpl.calls[0].options.headers['x-cg-demo-api-key'], 'test-key');
});

test('uses the pro host and header for the pro plan', async () => {
  const { client, fetchImpl } = makeClient([jsonResponse({})], { env: { COINGECKO_API_PLAN: 'pro' } });
  await client.get('/ping');
  assert.equal(fetchImpl.calls[0].url, 'https://pro-api.coingecko.com/api/v3/ping');
  assert.equal(fetchImpl.calls[0].options.headers['x-cg-pro-api-key'], 'test-key');
});

test('sends no credential header without a key', async () => {
  const config = loadConfig({}).coingecko;
  const { client, fetchImpl } = makeClient([jsonResponse({})], { config });
  await client.get('/ping');
  assert.equal(config.plan, 'public');
  assert.deepEqual(Object.keys(fetchImpl.calls[0].options.headers), ['accept']);
});

test('serves repeated requests from the cache until the ttl expires', async () => {
  const { client, fetchImpl, time } = makeClient([jsonResponse({ n: 1 }), jsonResponse({ n: 2 })]);
  await client.get('/ping', { ttlMs: 1000 });
  assert.equal((await client.get('/ping', { ttlMs: 1000 })).source, 'cache');
  assert.equal(fetchImpl.calls.length, 1);

  time.advance(1500);
  const refreshed = await client.get('/ping', { ttlMs: 1000 });
  assert.deepEqual(refreshed.data, { n: 2 });
  assert.equal(fetchImpl.calls.length, 2);
});

test('shares one upstream request between concurrent callers', async () => {
  const { client, fetchImpl } = makeClient([jsonResponse({ ok: true })]);
  await Promise.all([client.get('/ping'), client.get('/ping'), client.get('/ping')]);
  assert.equal(fetchImpl.calls.length, 1);
});

test('serves stale data when the upstream fails after the ttl', async () => {
  const { client, time } = makeClient([jsonResponse({ n: 1 }), jsonResponse({}, { status: 500 })]);
  await client.get('/ping', { ttlMs: 1000, staleMs: 10_000 });
  time.advance(2000);
  const result = await client.get('/ping', { ttlMs: 1000, staleMs: 10_000 });
  assert.deepEqual(result.data, { n: 1 });
  assert.equal(result.source, 'stale');
  assert.equal(result.fetchedAt, 1_000);
});

test('retries once on a server error and succeeds', async () => {
  const { client, fetchImpl } = makeClient([jsonResponse({}, { status: 503 }), jsonResponse({ ok: true })]);
  const { data } = await client.get('/ping');
  assert.deepEqual(data, { ok: true });
  assert.equal(fetchImpl.calls.length, 2);
});

test('retries once on a network error and then reports an upstream error', async () => {
  const { client, fetchImpl } = makeClient([new TypeError('fetch failed')]);
  await rejects(client.get('/ping'), 'upstream_error');
  assert.equal(fetchImpl.calls.length, 2);
});

test('maps timeouts without retrying', async () => {
  const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
  const { client, fetchImpl } = makeClient([timeout]);
  await rejects(client.get('/ping'), 'upstream_timeout');
  assert.equal(fetchImpl.calls.length, 1);
});

test('maps credential rejection, not found and invalid json', async () => {
  await rejects(makeClient([jsonResponse({}, { status: 401 })]).client.get('/ping'), 'upstream_unauthorized');
  await rejects(makeClient([jsonResponse({}, { status: 404 })]).client.get('/coins/none'), 'not_found');
  await rejects(makeClient([new Response('<html>', { status: 200 })]).client.get('/ping'), 'upstream_error');
});

test('a 429 starts a cooldown during which no upstream call is made', async () => {
  const { client, fetchImpl, time } = makeClient([
    jsonResponse({}, { status: 429, headers: { 'retry-after': '30' } }),
    jsonResponse({ ok: true }),
  ]);

  await rejects(client.get('/ping'), 'upstream_rate_limited');
  await rejects(client.get('/other'), 'upstream_rate_limited');
  assert.equal(fetchImpl.calls.length, 1);

  time.advance(31_000);
  assert.deepEqual((await client.get('/ping')).data, { ok: true });
  assert.equal(fetchImpl.calls.length, 2);
});

test('the local upstream budget blocks calls beyond the configured rate', async () => {
  const { client, fetchImpl } = makeClient([jsonResponse({ ok: true })], { env: { COINGECKO_RATE_LIMIT_PER_MINUTE: '2' } });
  await client.get('/a');
  await client.get('/b');
  await rejects(client.get('/c'), 'upstream_rate_limited');
  assert.equal(fetchImpl.calls.length, 2);
});

test('rejects unsafe paths before any request is made', async () => {
  const { client, fetchImpl } = makeClient([jsonResponse({})]);
  for (const path of ['ping', '/../secret', '//ping', '/ping?x=1', '/a b']) {
    await assert.rejects(client.get(path), /Invalid CoinGecko path/, path);
  }
  assert.equal(fetchImpl.calls.length, 0);
});
