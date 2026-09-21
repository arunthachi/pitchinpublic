import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appUrl,
  appUrlFor,
  marketingUrl,
  marketingUrlFor,
  normalizeSiteOrigin,
} from './site-urls';

test('keeps the marketing and product origins separate by default', () => {
  assert.equal(marketingUrl, 'https://www.pitchinpublic.io');
  assert.equal(appUrl, 'https://app.pitchinpublic.io');
  assert.equal(marketingUrlFor('/founders'), 'https://www.pitchinpublic.io/founders');
  assert.equal(appUrlFor('/?signin=1'), 'https://app.pitchinpublic.io/?signin=1');
});

test('normalizes configuration to an origin and rejects unsafe protocols', () => {
  assert.equal(
    normalizeSiteOrigin('https://example.com/some/path/', 'https://fallback.example'),
    'https://example.com'
  );
  assert.equal(
    normalizeSiteOrigin('javascript:alert(1)', 'https://fallback.example'),
    'https://fallback.example'
  );
  assert.equal(normalizeSiteOrigin('not a url', 'https://fallback.example'), 'https://fallback.example');
});

test('does not allow a path to replace the configured host', () => {
  assert.equal(marketingUrlFor('//malicious.example/path'), 'https://www.pitchinpublic.io/malicious.example/path');
});
