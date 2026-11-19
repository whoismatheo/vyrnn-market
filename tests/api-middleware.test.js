import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createApiMiddleware, resolveRoute } from '../config/api-middleware.js';

let root;
let server;
let baseUrl;

const echo = `export default (req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ query: req.query, method: req.method })); };`;

before(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'vyrnn-api-'));
  await mkdir(path.join(root, 'items', '[id]'), { recursive: true });
  await mkdir(path.join(root, '_lib'));
  await writeFile(path.join(root, 'ping.js'), echo);
  await writeFile(path.join(root, 'items', 'index.js'), echo);
  await writeFile(path.join(root, 'items', '[id].js'), echo);
  await writeFile(path.join(root, 'items', '[id]', 'chart.js'), echo);
  await writeFile(path.join(root, '_lib', 'secret.js'), echo);
  await writeFile(path.join(root, 'broken.js'), `export default () => { throw new Error('boom'); };`);

  const middleware = createApiMiddleware({ apiDir: root });
  server = http.createServer((req, res) =>
    middleware(req, res, () => {
      res.statusCode = 204;
      res.end();
    }),
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(root, { recursive: true, force: true });
});

const get = async (pathname) => {
  const response = await fetch(baseUrl + pathname);
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
};

test('resolves static, index and dynamic routes', async () => {
  assert.deepEqual((await resolveRoute(root, ['ping'])).params, {});
  assert.deepEqual((await resolveRoute(root, ['items', 'bitcoin'])).params, { id: 'bitcoin' });
  assert.deepEqual((await resolveRoute(root, ['items', 'bitcoin', 'chart'])).params, { id: 'bitcoin' });
  assert.ok((await resolveRoute(root, ['items'])).file.endsWith(path.join('items', 'index.js')));
  assert.equal(await resolveRoute(root, ['missing']), null);
  assert.equal(await resolveRoute(root, ['_lib', 'secret']), null);
});

test('serves a static endpoint with parsed query parameters', async () => {
  const { status, body } = await get('/api/ping?a=1&b=2&b=3');
  assert.equal(status, 200);
  assert.deepEqual(body.query, { a: '1', b: ['2', '3'] });
});

test('merges dynamic route parameters into the query', async () => {
  const { body } = await get('/api/items/wrapped-bitcoin/chart?days=7');
  assert.deepEqual(body.query, { days: '7', id: 'wrapped-bitcoin' });
});

test('decodes encoded segments', async () => {
  const { body } = await get('/api/items/a%20b');
  assert.deepEqual(body.query, { id: 'a b' });
});

test('returns json errors for unknown endpoints, private modules and malformed paths', async () => {
  assert.equal((await get('/api/nothing')).status, 404);
  assert.equal((await get('/api/_lib/secret')).status, 404);
  assert.equal((await get('/api/%E0%A4%A')).status, 400);
  assert.equal((await get('/api')).status, 404);
});

test('returns a generic 500 when a handler throws', async (t) => {
  t.mock.method(console, 'error', () => {});
  const { status, body } = await get('/api/broken');
  assert.equal(status, 500);
  assert.deepEqual(body, { error: { code: 'internal_error', message: 'Internal server error' } });
});

test('passes non-api requests to the next middleware', async () => {
  assert.equal((await get('/markets')).status, 204);
});
