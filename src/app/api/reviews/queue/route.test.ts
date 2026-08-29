import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./route.ts', import.meta.url), 'utf8');

test('queue loads one atomic snapshot with bounded caller-selected inputs', () => {
  assert.match(source, /Math\.min\(10, Math\.max\(1, requestedLimit\)\)/);
  assert.match(source, /searchParams\.get\('mode'\) === 'reviewer' \? 'reviewer' : 'founder'/);
  assert.match(source, /supabase\.rpc\('get_review_queue_snapshot', \{\s*target_limit: limit,\s*target_mode: mode,/);
  assert.doesNotMatch(source, /from\('review_assignments'\)/);
  assert.doesNotMatch(source, /claim_(global|trusted)_review_assignments/);
});
test('queue preserves assignment identity, signed pitch playback, and event context', () => {
  assert.match(source, /const signedUrls = await signPrivateRows\(pitches\)/);
  assert.match(source, /assignmentId,/);
  assert.match(source, /publicId: pitch\.public_id/);
  assert.match(source, /videoUrl: pitch\.video_url/);
  assert.match(source, /event: eventSlug \? \{ slug: eventSlug, name: eventName \} : null/);
});

test('queue maps trusted-reviewer denial to 403 and other snapshot failures to 500', () => {
  assert.match(source, /error\.message\?\.includes\('Trusted reviewer access'\) \? 403 : 500/);
  assert.match(source, /status === 403 \? 'Trusted reviewer access is required\.' : 'Could not load review queue'/);
});
