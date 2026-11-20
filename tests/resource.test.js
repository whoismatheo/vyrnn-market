import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createResource } from '../src/utils/resource.js';

test('reports loading then ready with data and metadata', async () => {
  const states = [];
  const resource = createResource(async () => ({ data: { n: 1 }, meta: { stale: false } }), (state) => states.push(state));
  await resource.load();
  assert.deepEqual(states, [{ phase: 'loading' }, { phase: 'ready', data: { n: 1 }, meta: { stale: false } }]);
});

test('reports errors without substituting data', async (t) => {
  t.mock.method(console, 'error', () => {});
  const states = [];
  const failure = new Error('down');
  await createResource(async () => {
    throw failure;
  }, (state) => states.push(state)).load();
  assert.deepEqual(states, [{ phase: 'loading' }, { phase: 'error', error: failure }]);
});

test('a newer load supersedes an older one', async () => {
  const states = [];
  const resolvers = [];
  const resource = createResource(
    (signal) =>
      new Promise((resolve) => {
        resolvers.push(() => resolve({ data: resolvers.length, meta: {}, aborted: signal.aborted }));
      }),
    (state) => states.push(state),
  );

  const first = resource.load();
  const second = resource.load();
  resolvers[0]();
  resolvers[1]();
  await Promise.all([first, second]);

  const ready = states.filter((state) => state.phase === 'ready');
  assert.equal(ready.length, 1);
  assert.equal(ready[0].data, 2);
});

test('abort silences pending results', async () => {
  const states = [];
  let release;
  const resource = createResource(
    () => new Promise((resolve) => (release = () => resolve({ data: 1, meta: {} }))),
    (state) => states.push(state),
  );
  const pending = resource.load();
  resource.abort();
  release();
  await pending;
  assert.deepEqual(states, [{ phase: 'loading' }]);
});
