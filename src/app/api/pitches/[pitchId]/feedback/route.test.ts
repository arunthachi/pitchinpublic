import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import * as feedbackRoute from './route';
import { feedbackSubmissionRpc } from './_server';

test('feedback route keeps event authorization on POST and exposes no destructive handler', () => {
  assert.equal(typeof feedbackRoute.POST, 'function');
  assert.equal(Reflect.has(feedbackRoute, 'DELETE'), false);
});

test('event feedback uses the event-scoped RPC while ordinary feedback remains compatible', () => {
  const scoped = feedbackSubmissionRpc('pitch-id', 'toast', '{}', 'request-id', 'event-id');
  assert.equal(scoped.name, 'submit_event_pitch_feedback');
  assert.equal(scoped.args.target_event_id, 'event-id');

  const ordinary = feedbackSubmissionRpc('pitch-id', 'roast', '{}', 'request-id');
  assert.equal(ordinary.name, 'submit_pitch_feedback');
  assert.equal(Reflect.has(ordinary.args, 'target_event_id'), false);
});

test('event feedback migration completes only an assignment from the requested event', () => {
  const migration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260805170000_scope_event_feedback_submission.sql'),
    'utf8',
  );
  assert.match(migration, /assignment\.event_id = target_event_id/);
  assert.match(migration, /submission\.event_id = target_event_id/);
  assert.match(migration, /participant\.event_id = target_event_id/);
  assert.match(migration, /INSERT INTO public\.review_assignments/);
  assert.match(migration, /ON CONFLICT \(event_id, pitch_id, reviewer_user_id\)/);
  assert.match(migration, /review_assignment_id IS NULL\s+OR NOT EXISTS/);
  assert.match(migration, /existing_assignment\.event_id = new_event_id/);
  assert.match(migration, /existing_assignment\.event_id IS NULL/);
  assert.match(migration, /existing\.event_id = target_event_id/);
  assert.match(migration, /assignment\.status IN \('pending', 'started'\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.resolve_event_feedback_scope/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.get_event_review_assignments/);
  assert.match(migration, /public\.can_view_event_review_workspace\(target_event_id\)/);
  assert.match(migration, /assignment\.event_id IS NULL/);
  assert.match(migration, /replay_assignment\.event_id IS NOT NULL/);
  assert.match(migration, /public\.is_trusted_reviewer_for_event\(target_event_id\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.get_review_assignment_event_identities/);
});
