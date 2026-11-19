import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRateLimiter } from '../api/_lib/rate-limit.js';

function clock(start = 0) {
  let time = start;
  return { now: () => time, advance: (ms) => (time += ms) };
}

test('allows requests up to the limit and blocks the next one', () => {
  const time = clock();
  const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: time.now });

  assert.equal(limiter.check('ip').allowed, true);
  assert.equal(limiter.check('ip').remaining, 0);
  const blocked = limiter.check('ip');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1);
});

test('resets after the window', () => {
  const time = clock();
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: time.now });
  limiter.check('ip');
  assert.equal(limiter.check('ip').allowed, false);

  time.advance(1000);
  assert.equal(limiter.check('ip').allowed, true);
});

test('tracks keys independently', () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
  assert.equal(limiter.check('a').allowed, true);
  assert.equal(limiter.check('b').allowed, true);
  assert.equal(limiter.check('a').allowed, false);
});

test('bounds the number of tracked keys', () => {
  const time = clock();
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 2, now: time.now });
  limiter.check('a');
  limiter.check('b');
  limiter.check('c');
  assert.equal(limiter.check('a').allowed, true);
});
