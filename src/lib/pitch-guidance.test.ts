import assert from 'node:assert/strict';
import test from 'node:test';
import { eligibleEventSubmissionPitches, founderBriefSchema, saveGuidelineDraftSchema } from './pitch-guidance';

const criteria = ['clarity', 'problem', 'solution', 'ask'].map((key) => ({ key, label: key, guidance: '' }));

test('accepts a four-to-six criterion immutable guideline payload', () => {
  const result = saveGuidelineDraftSchema.safeParse({ revision: 1, title: 'Demo day standard', criteria });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.disclosureMode, 'role_only');
});

test('rejects duplicate criterion keys and undersized rubrics', () => {
  assert.equal(saveGuidelineDraftSchema.safeParse({ revision: 1, title: 'Standard', criteria: criteria.slice(0, 3) }).success, false);
  assert.equal(saveGuidelineDraftSchema.safeParse({ revision: 1, title: 'Standard', criteria: [...criteria, criteria[0]] }).success, false);
});

test('enforces founder brief limits used by the database contract', () => {
  assert.equal(founderBriefSchema.safeParse({ tagline: 'x'.repeat(60) }).success, true);
  assert.equal(founderBriefSchema.safeParse({ tagline: 'x'.repeat(61) }).success, false);
});

test('structured event submission offers only pitches with trusted event and version bindings', () => {
  const pitches = [
    { id: 'trusted', event_id: 'event-1', event_guideline_version_id: 'version-1', event_recording_session_id: 'session-1' },
    { id: 'wrong-event', event_id: 'event-2', event_guideline_version_id: 'version-1', event_recording_session_id: 'session-2' },
    { id: 'legacy', event_id: 'event-1', event_guideline_version_id: 'version-1', event_recording_session_id: null },
  ];
  assert.deepEqual(
    eligibleEventSubmissionPitches(pitches, { id: 'event-1', guidance_mode: 'structured_active' }).map((pitch) => pitch.id),
    ['trusted'],
  );
  assert.equal(eligibleEventSubmissionPitches(pitches, { id: 'event-1', guidance_mode: 'legacy_open' }).length, 3);
});
