import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../api/_lib/errors.js';
import { createHealthHandler } from '../api/_lib/health.js';
import { createRateLimiter } from '../api/_lib/rate-limit.js';
import { createRequest, createResponse } from './helpers.js';

const limiter = () => createRateLimiter({ limit: 100, windowMs: 60_000 });

async function call(handler, request) {
  const res = createResponse();
  await handler(request, res);
  return res;
}

test('reports basic health without contacting the provider', async () => {
  let providerCalls = 0;
  const handler = createHealthHandler({
    limiter: limiter(),
    getClient: () => ({
      get: async () => {
        providerCalls += 1;
      },
    }),
  });
  const res = await call(handler, createRequest({ url: '/api/health' }));
  const { data } = res.json();

  assert.equal(res.statusCode, 200);
  assert.equal(data.status, 'ok');
  assert.equal(data.provider.name, 'coingecko');
  assert.ok(['public', 'demo', 'pro'].includes(data.provider.plan));
  assert.ok(!Number.isNaN(Date.parse(data.timestamp)));
  assert.equal('upstream' in data, false);
  assert.equal(providerCalls, 0);
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('never exposes credentials', async () => {
  process.env.COINGECKO_API_KEY = 'secret-value-123';
  const handler = createHealthHandler({ limiter: limiter() });
  const res = await call(handler, createRequest({ url: '/api/health' }));
  assert.doesNotMatch(res.body, /secret-value-123/);
  delete process.env.COINGECKO_API_KEY;
});

test('reports a reachable provider when asked to check it', async () => {
  const handler = createHealthHandler({
    limiter: limiter(),
    getClient: () => ({ get: async () => ({ data: {}, source: 'upstream' }) }),
  });
  const { data } = (await call(handler, createRequest({ url: '/api/health?check=upstream' }))).json();
  assert.equal(data.status, 'ok');
  assert.deepEqual(data.upstream, { reachable: true, source: 'upstream' });
});

test('reports a degraded status when the provider check fails', async () => {
  const handler = createHealthHandler({
    limiter: limiter(),
    getClient: () => ({
      get: async () => {
        throw ApiError.upstreamTimeout();
      },
    }),
  });
  const res = await call(handler, createRequest({ url: '/api/health?check=upstream' }));
  const { data } = res.json();
  assert.equal(res.statusCode, 200);
  assert.equal(data.status, 'degraded');
  assert.deepEqual(data.upstream, { reachable: false, error: 'upstream_timeout' });
});

test('rejects unknown parameters, invalid values and other methods', async () => {
  const handler = createHealthHandler({ limiter: limiter() });
  assert.equal((await call(handler, createRequest({ url: '/api/health?foo=1' }))).statusCode, 400);
  assert.equal((await call(handler, createRequest({ url: '/api/health?check=all' }))).statusCode, 400);
  assert.equal((await call(handler, createRequest({ method: 'DELETE', url: '/api/health' }))).statusCode, 405);
});
