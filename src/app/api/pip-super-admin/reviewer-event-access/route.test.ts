import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./route.ts', import.meta.url), 'utf8');

test('event-access revocation delegates grant removal and assignment invalidation atomically', () => {
  const deleteSource = source.split('export async function DELETE')[1] || '';
  assert.match(deleteSource, /revoke_trusted_reviewer_event_access_locked/);
  assert.match(deleteSource, /target_membership_id: resolved\.membership\.id/);
  assert.match(deleteSource, /target_event_id: resolved\.event\.id/);
  assert.doesNotMatch(deleteSource, /from\('review_assignments'\)\s*\.delete/);
  assert.doesNotMatch(deleteSource, /from\('trusted_reviewer_event_access'\)\s*\.delete/);
});
