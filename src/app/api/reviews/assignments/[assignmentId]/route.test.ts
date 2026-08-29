import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./route.ts', import.meta.url), 'utf8');

test('assignment detail is opened only through the caller-scoped database RPC', () => {
  assert.match(source, /supabase\.rpc\('get_review_assignment_detail', \{\s*target_assignment_id: assignmentId,/);
  assert.doesNotMatch(source, /from\('review_assignments'\)/);
  assert.doesNotMatch(source, /from\('pitches'\)/);
});
test('invalidated assignment results map to the recoverable 409 contract', () => {
  assert.match(source, /detail\?\.available === false && detail\.status === 'invalidated'/);
  assert.match(source, /code: 'assignment_invalidated'/);
  assert.match(source, /status: 409/);
  assert.match(source, /Your draft remains on this device/);
});

test('database invalidation errors map to 409 while unavailable assignments map to 404', () => {
  assert.match(source, /invalidated = \/invalidated\|no longer available\|not actionable\/i/);
  assert.match(source, /code: invalidated \? 'assignment_invalidated' : 'assignment_unavailable'/);
  assert.match(source, /status: invalidated \? 409 : 404/);
});

test('available detail preserves assignment context and a usable pitch payload', () => {
  assert.match(source, /const signed = await signPrivateRows\(\[rawPitch\]\)/);
  assert.match(source, /assignmentId: detail\.assignment_id \|\| detail\.id \|\| assignmentId/);
  assert.match(source, /eventSlug: detail\.event_slug \|\| detail\.event\?\.slug \|\| null/);
  assert.match(source, /feedback: Array\.isArray\(pitch\.feedback\) \? pitch\.feedback : \[\]/);
  assert.match(source, /feedbackState: pitch\.feedbackState \|\| pitch\.feedback_state \|\| 'available'/);
});
