import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./route.ts', import.meta.url), 'utf8');
const studioSource = readFileSync(new URL('../../../../../components/RecordingStudio.tsx', import.meta.url), 'utf8');

test('new recording sessions bind the server-side current standard', () => {
  assert.doesNotMatch(source, /request\.json|guidelineVersionId: z\.|requested_guideline_version_id/);
  assert.doesNotMatch(source, /requested_guideline_version_id/);
  assert.match(source, /start_event_recording_session', \{ target_event_id: event\.id \}/);
  assert.doesNotMatch(studioSource, /body: JSON\.stringify\(\{ guidelineVersionId/);
  assert.match(studioSource, /setSelectedGuidelineVersionId\(session\.guidelineVersionId\)/);
});

test('recording studio can retain the old version or restart with the current one', () => {
  assert.match(studioSource, /Keep recording with the plan you started/);
  assert.match(studioSource, /setSelectedGuidelineVersionId\(null\); setRecordingSessionId\(null\)/);
});

test('database session issuance cannot accept a historical standard version', () => {
  const migration = readFileSync(new URL('../../../../../../supabase/migrations/20260813120000_integrate_pitch_standard_plan.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(migration, /requested_guideline_version_id/);
  assert.match(migration, /start_event_recording_session\(target_event_id uuid\)/);
  assert.match(migration, /SELECT current_guideline_version_id INTO version_id/);
});

test('structured pitch creation and submission require the same consumed session binding', () => {
  const migration = readFileSync(new URL('../../../../../../supabase/migrations/20260813120000_integrate_pitch_standard_plan.sql', import.meta.url), 'utf8');
  assert.match(migration, /NEW\.event_recording_session_id IS NULL/);
  assert.match(migration, /prevent_pitch_binding_mutation_before_update/);
  assert.match(migration, /session_row\.consumed_by_pitch_id<>target_pitch_id/);
});

test('the pilot does not expose a client-authoritative improvement assessment RPC', () => {
  const migration = readFileSync(new URL('../../../../../../supabase/migrations/20260813120000_integrate_pitch_standard_plan.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(migration, /assess_pitch_improvement|pitch_improvement_assessments/);
});
