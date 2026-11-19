import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compilePath, matchRoute } from '../src/router.js';

const routes = [{ path: '/', name: 'home' }, { path: '/markets', name: 'markets' }, { path: '/coins/:id', name: 'coin' }];

test('matches static routes with and without a trailing slash', () => {
  assert.equal(matchRoute(routes, '/').route.name, 'home');
  assert.equal(matchRoute(routes, '/markets').route.name, 'markets');
  assert.equal(matchRoute(routes, '/markets/').route.name, 'markets');
});

test('extracts and decodes route parameters', () => {
  const match = matchRoute(routes, '/coins/wrapped%20bitcoin');
  assert.equal(match.route.name, 'coin');
  assert.deepEqual(match.params, { id: 'wrapped bitcoin' });
});

test('returns null for unknown paths', () => {
  assert.equal(matchRoute(routes, '/unknown'), null);
  assert.equal(matchRoute(routes, '/coins'), null);
  assert.equal(matchRoute(routes, '/coins/a/b'), null);
});

test('returns null for malformed percent-encoding', () => {
  assert.equal(matchRoute(routes, '/coins/%E0%A4%A'), null);
});

test('escapes regular expression characters in static segments', () => {
  const { regex } = compilePath('/a.b');
  assert.equal(regex.test('/a.b'), true);
  assert.equal(regex.test('/aXb'), false);
});
