import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../api/_lib/errors.js';
import { createHandler } from '../api/_lib/handler.js';
import { CACHE_CONTROL } from '../api/_lib/http.js';
import { createRateLimiter } from '../api/_lib/rate-limit.js';
import { createRequest, createResponse } from './helpers.js';

const limiter = () => createRateLimiter({ limit: 100, windowMs: 60_000 });

async function run(handler, request) {
  const res = createResponse();
  await handler(request, res);
  return res;
}

test('wraps successful results in an envelope with cache headers', async () => {
  const handler = createHandler(async () => ({ data: { a: 1 }, meta: { source: 'test' }, cache: CACHE_CONTROL.edge(10, 20) }), {
    limiter: limiter(),
  });
  const res = await run(handler, createRequest({ url: '/x' }));

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { data: { a: 1 }, meta: { source: 'test' } });
  assert.equal(res.headers['cache-control'], 'public, max-age=0, s-maxage=10, stale-while-revalidate=20');
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.match(res.headers['content-type'], /^application\/json/);
});

test('defaults to no-store and omits meta when absent', async () => {
  const handler = createHandler(async () => ({ data: 1 }), { limiter: limiter() });
  const res = await run(handler, createRequest());
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.deepEqual(res.json(), { data: 1 });
});

test('rejects disallowed methods with an Allow header', async () => {
  const handler = createHandler(async () => ({ data: 1 }), { limiter: limiter() });
  const res = await run(handler, createRequest({ method: 'POST' }));
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.allow, 'GET');
  assert.equal(res.json().error.code, 'method_not_allowed');
});

test('parses the query string from the url when req.query is absent', async () => {
  let seen;
  const handler = createHandler(async ({ query }) => {
    seen = { ...query };
    return { data: 1 };
  }, { limiter: limiter() });
  await run(handler, createRequest({ url: '/x?a=1&b=2&b=3' }));
  assert.deepEqual(seen, { a: '1', b: ['2', '3'] });
});

test('limits requests per client address and reports the limit headers', async () => {
  const handler = createHandler(async () => ({ data: 1 }), { limiter: createRateLimiter({ limit: 2, windowMs: 60_000 }) });
  const request = () => createRequest({ headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } });

  assert.equal((await run(handler, request())).headers['ratelimit-remaining'], '1');
  assert.equal((await run(handler, request())).statusCode, 200);
  const blocked = await run(handler, request());
  assert.equal(blocked.statusCode, 429);
  assert.ok(Number(blocked.headers['retry-after']) >= 1);
  assert.equal(blocked.json().error.code, 'rate_limited');

  const other = await run(handler, createRequest({ headers: { 'x-forwarded-for': '203.0.113.10' } }));
  assert.equal(other.statusCode, 200);
});

test('serializes ApiError instances with their status and headers', async () => {
  const handler = createHandler(async () => {
    throw ApiError.upstreamRateLimited(12);
  }, { limiter: limiter() });
  const res = await run(handler, createRequest());
  assert.equal(res.statusCode, 503);
  assert.equal(res.headers['retry-after'], '12');
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('hides unexpected error details from the client', async (t) => {
  t.mock.method(console, 'error', () => {});
  const handler = createHandler(async () => {
    throw new Error('database password is hunter2');
  }, { limiter: limiter() });
  const res = await run(handler, createRequest());
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.json(), { error: { code: 'internal_error', message: 'Internal server error' } });
  assert.doesNotMatch(res.body, /hunter2/);
});
