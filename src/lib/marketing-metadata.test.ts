import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMarketingMetadata } from './marketing-metadata';

test('uses the canonical marketing origin for route and social metadata', () => {
  const metadata = buildMarketingMetadata('founders');
  assert.equal(metadata.alternates?.canonical, 'https://www.pitchinpublic.io/founders');
  assert.equal(metadata.openGraph?.url, 'https://www.pitchinpublic.io/founders');
  assert.deepEqual(metadata.robots, { index: true, follow: true });
});

test('keeps the early-access terms page out of the index until legal approval', () => {
  assert.deepEqual(buildMarketingMetadata('terms').robots, { index: false, follow: true });
});
