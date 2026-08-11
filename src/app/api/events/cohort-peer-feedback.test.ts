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
