import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  NO_VALUE,
  formatCompactCurrency,
  formatInteger,
  formatPercentChange,
  formatPercentShare,
  formatPrice,
  percentChange,
} from '../src/utils/format.js';

test('formats large amounts compactly in US dollars', () => {
  assert.equal(formatCompactCurrency(2_450_000_000_000, 'en'), '$2.45T');
  assert.equal(formatCompactCurrency(98_200_000_000, 'en'), '$98.2B');
  assert.equal(formatCompactCurrency(0.52, 'en'), '$0.52');
});

test('adapts price precision to the magnitude of the price', () => {
  assert.equal(formatPrice(91234.5, 'en'), '$91,234.50');
  assert.equal(formatPrice(1, 'en'), '$1.00');
  assert.equal(formatPrice(0.5, 'en'), '$0.50');
  assert.equal(formatPrice(0.1234567, 'en'), '$0.1235');
  assert.equal(formatPrice(0.00001234, 'en'), '$0.00001234');
});

test('formats percentage changes with an explicit sign', () => {
  assert.equal(formatPercentChange(1.234, 'en'), '+1.23%');
  assert.equal(formatPercentChange(-0.5, 'en'), '-0.50%');
  assert.equal(formatPercentChange(0, 'en'), '0.00%');
  assert.equal(formatPercentShare(57.31, 'en'), '57.3%');
});

test('follows the locale number conventions', () => {
  assert.match(formatPrice(1234.5, 'es'), /1234,50|1\.234,50/);
  assert.match(formatPercentShare(57.31, 'fr'), /57,3/);
});

test('missing values render as a neutral placeholder', () => {
  for (const format of [formatCompactCurrency, formatPrice, formatPercentChange, formatPercentShare, formatInteger]) {
    assert.equal(format(null, 'en'), NO_VALUE);
    assert.equal(format(undefined, 'en'), NO_VALUE);
    assert.equal(format(Number.NaN, 'en'), NO_VALUE);
  }
});

test('computes the percentage change between two prices', () => {
  assert.equal(percentChange(100, 110), 10);
  assert.equal(percentChange(200, 150), -25);
  assert.equal(percentChange(0, 10), null);
  assert.equal(percentChange(null, 10), null);
});
