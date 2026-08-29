import assert from 'node:assert/strict';
import test from 'node:test';
import * as pitchRoute from './route';
import { hashPitchCreationPayload, parsePitchIdempotencyKey, structuredFeedbackProvenance } from './_server';
import { FOUNDER_FEEDBACK_RPC_MAX_PITCH_IDS, loadFeedbackInBatches } from '@/lib/feedback-enrichment';

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
  assert.equal(pitchSchema.safeParse({ ...base, eventSlug: 'demo-day', recordingSessionId: KEY }).success, true);
  assert.equal(pitchSchema.safeParse({ ...base, eventSlug: '' }).success, false);
  assert.equal(pitchSchema.safeParse({ ...base, eventSlug: 'x'.repeat(121) }).success, false);
});

test('structured pitch creation consumes a server-owned recording session', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('./route.ts', import.meta.url), 'utf8');
  assert.match(source, /guidance_mode === 'structured_active'/);
  assert.match(source, /event_recording_session_id: pitchData\.recordingSessionId/);
});

test('pitch reads preserve the immutable event standard and structured feedback provenance', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('./route.ts', import.meta.url), 'utf8');
  const contract = await readFile(
    new URL('../../../../supabase/migrations/20260829000021_add_incident_database_contracts.sql', import.meta.url),
    'utf8',
  );
  assert.match(source, /get_founder_pitch_feedback/);
  assert.match(contract, /event_guideline_version_id uuid/);
  assert.match(contract, /criterion_key text/);
  assert.match(contract, /observation text/);
  assert.match(contract, /next_step text/);
  assert.match(contract, /disclosure_mode text/);
  assert.match(source, /structuredFeedbackProvenance\(feedback\)/);
  assert.deepEqual(structuredFeedbackProvenance({
    event_guideline_version_id: 'version-1', criterion_key: 'ask', observation: 'The ask is broad', next_step: 'Name one specific request', disclosure_mode: 'named', author: { full_name: 'Coach Lee' },
  }), {
    event_guideline_version_id: 'version-1', criterion_key: 'ask', observation: 'The ask is broad', next_step: 'Name one specific request', disclosure_mode: 'named', author_name: 'Coach Lee', display_role_only: false,
  });
  assert.equal(structuredFeedbackProvenance({ disclosure_mode: 'anonymous_to_founder', author: { full_name: 'Hidden' } }).author_name, null);
});

test('structured pitch bindings are immutable and final submission verifies the consumed session', async () => {
  const { readFile } = await import('node:fs/promises');
  const migration = await readFile(new URL('../../../../supabase/migrations/20260813120000_integrate_pitch_standard_plan.sql', import.meta.url), 'utf8');
  assert.match(migration, /Structured pitches require a trusted recording-session binding/);
  assert.match(migration, /prevent_pitch_binding_mutation_before_update/);
  assert.match(migration, /session_row\.consumed_by_pitch_id<>target_pitch_id/);
  assert.match(migration, /session_row\.guideline_version_id<>pitch_row\.event_guideline_version_id/);
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
  assert.match(
    migration,
    /can_view_pitch_via_event_submission/,
    'multi-event pitches stay readable via every submission event',
  );
  assert.equal(
    (migration.match(/NOT EXISTS/g) || []).length >= 3,
    true,
    'assignment cleanup must spare event members, organizers, and submission-event members',
  );
});

test('feedback visibility migration scopes feedback to its pitch', async () => {
  const { readFile } = await import('node:fs/promises');
  const migration = await readFile(
    new URL('../../../../supabase/migrations/20260808190000_scope_feedback_to_pitch_visibility.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.can_view_pitch\(target_pitch_id uuid\)/);
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /p\.visibility = 'public'/, 'helper must mirror the strict public policy — no unlisted');
  assert.doesNotMatch(migration, /'unlisted'/);
  assert.match(migration, /can_trusted_reviewer_view_pitch\(p\.id\)/);
  assert.match(migration, /can_view_pitch_via_event_submission\(p\.id\)/);
  assert.match(migration, /ON public\.feedback FOR SELECT/);
  assert.match(migration, /is_public = true AND public\.can_view_pitch\(pitch_id\)/, 'anon feedback reads must require pitch visibility');
});

test('event-scoped feed params are read alongside the existing filters', () => {
  const params = new URLSearchParams('limit=20&eventSlug=speed-networking');
  assert.equal(params.get('eventSlug'), 'speed-networking');
  assert.equal(new URLSearchParams('limit=20').get('eventSlug'), null);
});

test('the feed route scopes by event and skips the public-only filter', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('./route.ts', import.meta.url), 'utf8');
  assert.match(source, /const eventSlug = searchParams\.get\('eventSlug'\)/);
  assert.match(source, /from\('pitch_events'\)[\s\S]{0,200}\.eq\('slug', eventSlug\)/);
  assert.match(
    source,
    /if \(eventScopeId\) \{\s*\/\/[^\n]*\n\s*query = query\.eq\('event_id', eventScopeId\);\s*\} else if/,
    'event scoping must replace, not stack with, the public-only filter',
  );
  assert.match(
    source,
    /if \(eventScopeId\) \{\s*countQuery = countQuery\.eq\('event_id', eventScopeId\);\s*\} else if/,
    'count query must mirror the data query',
  );
});

test('pitch reads keep base rows independent from feedback enrichment failures', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('./route.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /feedback\s*\(/, 'base pitch selects must not embed feedback');
  assert.match(source, /loadFeedbackInBatches<any>\(pitchIds/);
  assert.match(source, /\.rpc\('get_founder_pitch_feedback', \{ target_pitch_ids: batch \}\)/);
  assert.match(source, /feedbackState: feedbackEnrichment\.feedbackState/);
  assert.match(source, /returning base pitches/);
  assert.match(source, /error: countError/);
  assert.match(source, /if \(countError\) throw countError/);
});

test('pitch reads split more than 50 pitch IDs across contract-safe feedback RPC calls', async () => {
  const pitchIds = Array.from(
    { length: FOUNDER_FEEDBACK_RPC_MAX_PITCH_IDS + 1 },
    (_, index) => `pitch-${index + 1}`,
  );
  const rpcCalls: string[][] = [];

  const result = await loadFeedbackInBatches(pitchIds, async (batch) => {
    rpcCalls.push(batch);
    return { data: batch.map((pitch_id) => ({ pitch_id })), error: null };
  });

  assert.deepEqual(rpcCalls.map((batch) => batch.length), [50, 1]);
  assert.equal(rpcCalls.every((batch) => batch.length <= 50), true);
  assert.equal(result.feedbackState, 'available');
});
