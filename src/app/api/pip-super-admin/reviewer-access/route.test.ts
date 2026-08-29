import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./route.ts', import.meta.url), 'utf8');

test('membership revocation uses the authenticated atomic lifecycle RPC', () => {
  assert.match(source, /createRequestSupabase\(request\)/);
  assert.match(source, /revoke_trusted_reviewer_membership_locked/);
  assert.match(source, /target_membership_id: membership\.id/);
  assert.doesNotMatch(source, /trusted_reviewer_memberships'\)\s*\.update/);
  assert.doesNotMatch(source, /trusted_reviewer_event_access'\)\s*\.delete/);
});
