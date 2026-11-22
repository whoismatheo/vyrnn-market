import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_ASSETS, buildComparisonUrl, parseComparison } from '../src/utils/compare-state.js';

test('reads assets and range from the query string', () => {
  assert.deepEqual(parseComparison('?ids=bitcoin,ethereum,solana&range=30'), { ids: ['bitcoin', 'ethereum', 'solana'], range: '30' });
});

test('falls back to defaults for missing or unknown values', () => {
  assert.deepEqual(parseComparison(''), { ids: [], range: '7' });
  assert.deepEqual(parseComparison('?ids=bitcoin&range=999'), { ids: ['bitcoin'], range: '7' });
  assert.deepEqual(parseComparison('?range=1'), { ids: [], range: '1' });
});

test('drops invalid identifiers and duplicates and enforces the maximum', () => {
  const ids = parseComparison('?ids=bitcoin,Bad%20Id,../x,bitcoin,,ethereum,a,b,c,d').ids;
  assert.deepEqual(ids, ['bitcoin', 'ethereum', 'a', 'b']);
  assert.equal(ids.length, MAX_ASSETS);
});

test('rejects identifiers that are too long', () => {
  assert.deepEqual(parseComparison(`?ids=${'a'.repeat(101)},bitcoin`).ids, ['bitcoin']);
});

test('builds short shareable URLs and omits defaults', () => {
  assert.equal(buildComparisonUrl({ ids: [], range: '7' }), '/compare');
  assert.equal(buildComparisonUrl({ ids: ['bitcoin', 'ethereum'], range: '7' }), '/compare?ids=bitcoin,ethereum');
  assert.equal(buildComparisonUrl({ ids: ['bitcoin', 'ethereum'], range: '365' }), '/compare?ids=bitcoin,ethereum&range=365');
  assert.equal(buildComparisonUrl({ ids: [], range: '30' }), '/compare?range=30');
});

test('a built URL parses back to the same state', () => {
  const state = { ids: ['bitcoin', 'wrapped-bitcoin', 'usd-coin'], range: '90' };
  assert.deepEqual(parseComparison(buildComparisonUrl(state).split('?')[1]), state);
});
