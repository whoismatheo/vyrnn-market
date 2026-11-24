import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../api/_lib/errors.js';
import { identifier, integer, oneOf, validateQuery } from '../api/_lib/validation.js';

const schema = {
  page: integer({ min: 1, max: 10, fallback: 1 }),
  order: oneOf(['asc', 'desc'], { fallback: 'desc' }),
  id: identifier({ required: true }),
};

test('applies fallbacks and parses valid values', () => {
  assert.deepEqual(validateQuery({ id: 'bitcoin' }, schema), { page: 1, order: 'desc', id: 'bitcoin' });
  assert.deepEqual(validateQuery({ id: 'usd-coin', page: '3', order: 'asc' }, schema), {
    page: 3,
    order: 'asc',
    id: 'usd-coin',
  });
});

test('rejects unknown, missing, repeated and malformed parameters', () => {
  const cases = [
    { id: 'x', extra: '1' },
    {},
    { id: ['a', 'b'] },
    { id: 'x', page: '0' },
    { id: 'x', page: '1.5' },
    { id: 'x', page: '11' },
    { id: 'x', order: 'sideways' },
    { id: 'Bad Id' },
    { id: '../etc' },
    { id: 'a'.repeat(101) },
  ];

  for (const query of cases) {
    assert.throws(
      () => validateQuery(query, schema),
      (error) => error instanceof ApiError && error.status === 400,
      JSON.stringify(query),
    );
  }
});

test('does not treat inherited object keys as known parameters', () => {
  assert.throws(() => validateQuery({ id: 'x', constructor: '1' }, schema), ApiError);
});

test('parses identifier lists, removing duplicates and sorting them', async () => {
  const { identifierList } = await import('../api/_lib/validation.js');
  const list = { ids: identifierList({ max: 3 }) };
  assert.deepEqual(validateQuery({ ids: 'ethereum,bitcoin,bitcoin' }, list), { ids: ['bitcoin', 'ethereum'] });
  assert.deepEqual(validateQuery({}, list), { ids: undefined });
});

test('rejects identifier lists that are too long or malformed', async () => {
  const { identifierList } = await import('../api/_lib/validation.js');
  const list = { ids: identifierList({ max: 2 }) };
  for (const ids of ['a,b,c', ',', 'Bitcoin', 'a,../b', 'a b']) {
    assert.throws(() => validateQuery({ ids }, list), (error) => error instanceof ApiError && error.status === 400, ids);
  }
});

test('normalizes and validates search text', async () => {
  const { searchText } = await import('../api/_lib/validation.js');
  const schema = { q: searchText({ required: true }) };
  assert.deepEqual(validateQuery({ q: '  Bitcoin   CASH ' }, schema), { q: 'bitcoin cash' });
  assert.deepEqual(validateQuery({ q: 'Dog-e_coin.' }, schema), { q: 'dog-e_coin.' });
  assert.deepEqual(validateQuery({ q: '\u00c9ther' }, schema), { q: '\u00e9ther' });
});

test('rejects search text that is empty, too short, too long or contains symbols', async () => {
  const { searchText } = await import('../api/_lib/validation.js');
  const schema = { q: searchText({ required: true }) };
  for (const q of ['', ' ', 'a', ' a ', 'x'.repeat(41), 'bit<coin', 'a&b=c', 'drop;table', 'a/b', '%00ab']) {
    assert.throws(() => validateQuery(q === '' ? {} : { q }, schema), (error) => error instanceof ApiError && error.status === 400, JSON.stringify(q));
  }
});

test('parses plain decimal numbers within bounds', async () => {
  const { number } = await import('../api/_lib/validation.js');
  const schema = { v: number({ min: -100, max: 1000 }) };
  assert.deepEqual(validateQuery({ v: '12.5' }, schema), { v: 12.5 });
  assert.deepEqual(validateQuery({ v: '-100' }, schema), { v: -100 });
  assert.deepEqual(validateQuery({ v: '1000' }, schema), { v: 1000 });
  assert.deepEqual(validateQuery({}, schema), { v: undefined });
});

test('rejects numbers that are malformed or out of bounds', async () => {
  const { number } = await import('../api/_lib/validation.js');
  const schema = { v: number({ min: 0, max: 10 }) };
  for (const v of ['-1', '11', '1e3', '0x10', 'NaN', 'Infinity', '1,5', '.5', '5.', ' 5', '5%']) {
    assert.throws(() => validateQuery({ v }, schema), (error) => error instanceof ApiError && error.status === 400, v);
  }
});
