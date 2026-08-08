import assert from 'node:assert/strict';
import test from 'node:test';
import * as pitchRoute from './route';

const { hashPitchCreationPayload, parsePitchIdempotencyKey } = pitchRoute;

const KEY = '70d46f48-2f9b-4a3c-9500-8309a86e7639';

test('pitch idempotency keys are optional but must be UUIDs when present', () => {
  assert.deepEqual(parsePitchIdempotencyKey(null), { key: null, valid: true });
  assert.deepEqual(parsePitchIdempotencyKey(KEY), { key: KEY, valid: true });
  assert.deepEqual(parsePitchIdempotencyKey('retry-1'), { key: null, valid: false });
});

test('equivalent normalized pitch payloads have the same hash and changed payloads conflict', () => {
  const payload = {
    hook: 'A clear pitch hook',
    videoId: 'video-1',
    playbackUrl: 'https://example.com/video.m3u8',
    duration: 60,
  };

  assert.equal(hashPitchCreationPayload(payload), hashPitchCreationPayload({ ...payload }));
  assert.notEqual(
    hashPitchCreationPayload(payload),
    hashPitchCreationPayload({ ...payload, hook: 'A materially different pitch hook' })
  );
});

test('pitch creation route does not expose DELETE', () => {
  assert.equal(Reflect.has(pitchRoute, 'DELETE'), false);
});

test('pitch payloads may bind to an event by slug, within limits', async () => {
  const { pitchSchema } = await import('@/lib/validation');
  const base = { hook: 'A clear pitch hook', videoId: 'v', playbackUrl: 'https://example.com/v.m3u8', duration: 60 };
  assert.equal(pitchSchema.safeParse({ ...base }).success, true);
  assert.equal(pitchSchema.safeParse({ ...base, eventSlug: 'demo-day' }).success, true);
  assert.equal(pitchSchema.safeParse({ ...base, eventSlug: '' }).success, false);
  assert.equal(pitchSchema.safeParse({ ...base, eventSlug: 'x'.repeat(121) }).success, false);
});

test('event privacy migration enforces visibility, member reads, and the approved backfill', async () => {
  const { readFile } = await import('node:fs/promises');
  const migration = await readFile(
    new URL('../../../../supabase/migrations/20260808180000_enforce_event_pitch_privacy.sql', import.meta.url),
    'utf8',
  );
  assert.match(
    migration,
    /ALTER TABLE public\.pitches\s+ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public\.pitch_events\(id\)/,
    'pitches.event_id must be created by this migration - it does not pre-exist',
  );
  assert.match(migration, /AND visibility = 'public'\s*\)/, 'public reads must not widen to unlisted');
  assert.doesNotMatch(migration, /'unlisted'\)\s*\)/, 'no unlisted widening in any policy');
  assert.match(migration, /DROP POLICY IF EXISTS "Pitches are viewable by everyone"/);
  assert.match(migration, /DROP POLICY IF EXISTS "Published pitches are viewable by everyone"/);
  assert.match(migration, /is_pitch_event_member\(event_id\)/);
  assert.match(migration, /is_pitch_event_owner\(event_id\)/);
  assert.match(migration, /SELECT DISTINCT ON \(pitch_id\)/, 'multi-event backfill must be deterministic');
  assert.match(migration, /ORDER BY pitch_id, submitted_at DESC/);
  assert.match(migration, /p\.visibility = 'public'/, 'backfill must only touch currently-public rows');
  assert.match(migration, /DELETE FROM public\.review_assignments/, 'stranded assignments must be cleaned up');
  assert.match(migration, /ra\.status IN \('pending', 'started'\)/);
  assert.match(migration, /idx_pitches_public_feed/);
  assert.match(migration, /idx_pitches_event/);
});
