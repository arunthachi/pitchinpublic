import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./route.ts', import.meta.url), 'utf8');

test('participant eligibility changes use the locked assignment lifecycle RPC', () => {
  assert.match(source, /rpc\(\s*'update_event_participant_locked'/);
  assert.match(source, /target_event_id: event\.id/);
  assert.match(source, /target_participant_id: participant\.id/);
  assert.match(source, /target_role: hasRoleUpdate \? validation\.data\.role : null/);
  assert.match(source, /target_status: hasStatusUpdate \? validation\.data\.status : null/);
  assert.doesNotMatch(source, /from\('pitch_event_participants'\)\s*\.update/);
});
