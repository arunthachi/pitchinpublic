import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildSubmissionSuccessResponse } from './_server';

test('structured final submission uses one atomic RPC while retaining legacy path', async () => {
  const source = await readFile(new URL('./route.ts', import.meta.url), 'utf8');
  const postSource = source.split('export async function DELETE')[0];
  assert.match(source, /guidance_mode === 'structured_active'/);
  assert.match(source, /rpc\('submit_structured_event_final_take'/);
  assert.match(postSource, /submit_legacy_event_final_take_atomic/);
  assert.doesNotMatch(postSource, /from\('pitch_event_submissions'\)/, 'legacy submission must not commit outside the atomic RPC');
  assert.doesNotMatch(postSource, /bind_pitch_to_event_locked/, 'legacy binding must not run as a second transaction');
});

test('legacy final submission binds privacy and upserts within one database transaction', async () => {
  const migration = await readFile(
    resolve(process.cwd(), 'supabase/migrations/20260829002326_make_event_submission_atomic.sql'),
    'utf8',
  );

  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.submit_legacy_event_final_take_atomic/);
  assert.match(migration, /FOR SHARE/);
  assert.match(migration, /FOR UPDATE/);
  assert.match(migration, /app\.atomic_event_pitch_binding/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.prevent_pitch_binding_mutation/);
  assert.match(migration, /pitch_row\.event_id IS NOT NULL AND pitch_row\.event_id <> event_row\.id/);
  assert.match(migration, /SET event_id = event_row\.id,\s+visibility = 'private'/);
  assert.match(migration, /reconcile_pitch_review_assignments/);
  assert.match(migration, /INSERT INTO public\.pitch_event_submissions/);
  assert.match(migration, /ON CONFLICT \(event_id, user_id\) DO UPDATE/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.submit_legacy_event_final_take_atomic\(uuid, uuid\)/);
});

test('atomic RPC response retains the existing API response shape', () => {
  const response = buildSubmissionSuccessResponse(
    { id: 'submission-id', status: 'submitted' },
    { id: 'pitch-id', public_id: 'p_public' },
    true,
  );

  assert.deepEqual(response, {
    success: true,
    submission: { id: 'submission-id', status: 'submitted' },
    pitchId: 'pitch-id',
    publicId: 'p_public',
    visibilityChanged: true,
  });
});

test('final-take removal invalidates assignments in the same locked database transaction', async () => {
  const source = await readFile(new URL('./route.ts', import.meta.url), 'utf8');
  const deleteSource = source.split('export async function DELETE')[1] || '';

  assert.match(deleteSource, /rpc\('delete_my_event_submission_locked'/);
  assert.match(deleteSource, /target_event_id: event\.id/);
  assert.doesNotMatch(deleteSource, /from\('pitch_event_submissions'\)\s*\.delete/);
  assert.match(deleteSource, /locked\|deadline has passed/);
});
