import assert from 'node:assert/strict';
import test from 'node:test';
import { formatNumber } from './utils';

test('formatNumber keeps incomplete API metrics render-safe', () => {
  assert.equal(formatNumber(undefined), '0');
  assert.equal(formatNumber(null), '0');
  assert.equal(formatNumber(Number.NaN), '0');
});

test('formatNumber preserves compact metric formatting', () => {
  assert.equal(formatNumber(17), '17');
  assert.equal(formatNumber(1_500), '1.5K');
  assert.equal(formatNumber(2_000_000), '2.0M');
});
