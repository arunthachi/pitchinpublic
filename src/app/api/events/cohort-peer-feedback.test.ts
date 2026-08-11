import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parseEventUpdate } from './[slug]/_server';

const MIGRATION = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260811060000_enable_cohort_peer_feedback.sql'),
  'utf8',
);

const current = {
  event_date: '2026-09-03',
  submission_deadline: '2026-08-27',
};

test('an organizer can turn peer feedback off and on', () => {
  const off = parseEventUpdate({ peerFeedbackEnabled: false }, current);
  assert.equal(off.success, true);
  assert.equal(off.success && off.update.peer_feedback_enabled, false);

  const on = parseEventUpdate({ peerFeedbackEnabled: true }, current);
  assert.equal(on.success && on.update.peer_feedback_enabled, true);
});

test('an unrelated event edit leaves peer feedback untouched', () => {
  // An absent field must not silently re-enable a competition organizer's
  // deliberately closed event.
  const parsed = parseEventUpdate({ name: 'Speed Networking' }, current);
  assert.equal(parsed.success, true);
  assert.equal(parsed.success && 'peer_feedback_enabled' in parsed.update, false);
});

test('the peer-feedback flag rejects non-boolean input', () => {
  const parsed = parseEventUpdate({ peerFeedbackEnabled: 'yes' }, current);
  assert.equal(parsed.success, false);
});

/*
 * The migration cannot be executed here, so these assert the authorization
 * predicate's shape. They are a tripwire, not a substitute for the live actor
 * matrix run against staging.
 */

test('the peer branch requires active membership, the flag, and a live event', () => {
  const branch = MIGRATION.slice(MIGRATION.indexOf('AS peer_event'));
  for (const clause of [
    'peer_participant.user_id = caller_id',
    "peer_participant.status = 'active'",
    'peer_event.peer_feedback_enabled',
    "peer_event.status <> 'archived'",
  ]) {
    assert.ok(branch.includes(clause), `peer branch is missing: ${clause}`);
  }
});

test('the owner exclusion and submission requirement still gate every path', () => {
  // Both predate this change and must survive it: they are what stop someone
  // reviewing their own take, or a take never entered into the event.
  assert.match(MIGRATION, /A reviewer cannot leave feedback on their own pitch/);
  assert.match(MIGRATION, /This pitch was not submitted to that event/);
});

test('peer reviews are tagged apart from organizer-side reviews', () => {
  assert.match(MIGRATION, /'cohort_peer_feedback'/);
  assert.match(MIGRATION, /'event_team_feedback'/);
});

test('the flag defaults on and is added without a backfill', () => {
  assert.match(
    MIGRATION,
    /ADD COLUMN IF NOT EXISTS peer_feedback_enabled boolean NOT NULL DEFAULT true/,
  );
});

test('both authorization surfaces gained the peer branch', () => {
  // resolve_event_feedback_scope is the route's pre-check and
  // submit_event_pitch_feedback is the write path. Widening only one would
  // either show a form that fails, or accept writes the pre-check refuses.
  assert.match(MIGRATION, /CREATE OR REPLACE FUNCTION public\.submit_event_pitch_feedback/);
  assert.match(MIGRATION, /CREATE OR REPLACE FUNCTION public\.resolve_event_feedback_scope/);
  assert.equal((MIGRATION.match(/peer_feedback_enabled/g) || []).length >= 4, true);
});

test('the re-created functions are faithful copies plus exactly the intended additions', () => {
  // This migration re-creates two SECURITY DEFINER functions by copying their
  // bodies and splicing in one branch. A clause dropped in that copy would
  // silently delete a security check, so strip the intended additions back out
  // and require byte equality with the originals.
  const ORIGINAL = readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260805170000_scope_event_feedback_submission.sql'),
    'utf8',
  );

  const grab = (src: string, marker: string) => {
    const i = src.indexOf(marker);
    assert.notEqual(i, -1, `missing ${marker}`);
    return src.slice(i, src.indexOf('\n$$;', i) + 4);
  };

  const PEER_SUBMIT = `    OR EXISTS (
      SELECT 1
      FROM public.pitch_events AS peer_event
      JOIN public.pitch_event_participants AS peer_participant
        ON peer_participant.event_id = peer_event.id
       AND peer_participant.user_id = caller_id
       AND peer_participant.status = 'active'
      WHERE peer_event.id = target_event_id
        AND peer_event.peer_feedback_enabled
        AND peer_event.status <> 'archived'
    )\n`;

  const PEER_RESOLVE = `      OR EXISTS (
        SELECT 1
        FROM public.pitch_event_participants AS peer_participant
        WHERE peer_participant.event_id = event.id
          AND peer_participant.user_id = auth.uid()
          AND peer_participant.status = 'active'
          AND event.peer_feedback_enabled
          AND event.status <> 'archived'
      )\n`;

  const REASON_NEW = `      CASE
        WHEN EXISTS (
          SELECT 1
          FROM public.pitch_events AS team_event
          WHERE team_event.id = target_event_id
            AND team_event.organizer_id = caller_id
        ) OR EXISTS (
          SELECT 1
          FROM public.pitch_event_participants AS team_participant
          WHERE team_participant.event_id = target_event_id
            AND team_participant.user_id = caller_id
            AND team_participant.status = 'active'
            AND team_participant.role IN ('organizer', 'admin', 'coach', 'mentor', 'judge')
        ) THEN 'event_team_feedback'
        ELSE 'cohort_peer_feedback'
      END,`;

  const submitMarker = 'CREATE OR REPLACE FUNCTION public.submit_event_pitch_feedback(';
  let submit = grab(MIGRATION, submitMarker);
  assert.ok(submit.includes(PEER_SUBMIT), 'peer branch missing from the write path');
  submit = submit.replace(PEER_SUBMIT, '').replace(REASON_NEW, `      'event_team_feedback',`);
  assert.equal(submit, grab(ORIGINAL, submitMarker), 'submit_event_pitch_feedback drifted from the original');

  const resolveMarker = 'CREATE OR REPLACE FUNCTION public.resolve_event_feedback_scope(';
  let resolve = grab(MIGRATION, resolveMarker);
  assert.ok(resolve.includes(PEER_RESOLVE), 'peer branch missing from the pre-check');
  resolve = resolve.replace(PEER_RESOLVE, '');
  assert.equal(resolve, grab(ORIGINAL, resolveMarker), 'resolve_event_feedback_scope drifted from the original');
});
