import assert from 'node:assert/strict';
import test from 'node:test';
import sitemap from './sitemap';

test('lists only canonical marketing routes on the marketing origin', () => {
  const entries = sitemap();
  assert.deepEqual(
    entries.map((entry) => entry.url),
    [
      'https://www.pitchinpublic.io/',
      'https://www.pitchinpublic.io/for-events',
      'https://www.pitchinpublic.io/founders',
      'https://www.pitchinpublic.io/about',
      'https://www.pitchinpublic.io/contact',
    ]
  );
  assert.equal(entries.some((entry) => entry.url.includes('/leaderboard')), false);
  assert.equal(entries.some((entry) => entry.url.includes('app.pitchinpublic.io')), false);
});

test('does not manufacture last-modified dates without a content revision source', () => {
  for (const entry of sitemap()) {
    assert.equal('lastModified' in entry, false);
  }
});
