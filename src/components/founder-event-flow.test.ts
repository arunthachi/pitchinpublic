import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEventSubmissionBody, shouldOpenPitchPlan } from './RecordingStudio';
import { validatePitchDetails } from './Step2_AddDetails';
import { buildSubmissionSuccessResponse } from '../app/api/events/[slug]/submission/_server';
import { getEventSubmissionRetryKey } from '@/lib/idempotency';
import { readFileSync } from 'node:fs';

const studioSource = readFileSync(new URL('./RecordingStudio.tsx', import.meta.url), 'utf8');

test('returning founders can submit with saved one-line pitch and no optional fields', () => {
  assert.deepEqual(validatePitchDetails({
    hook: 'We help early founders explain their product clearly.',
    startupName: '',
    feedbackAsk: '',
    context: '',
  }), {});
});

test('event final submission requires only the four required pitch-plan fields', () => {
  const finalSubmissionBlock = studioSource.slice(
    studioSource.indexOf('const missing = ['),
    studioSource.indexOf('].filter', studioSource.indexOf('const missing = [')),
  );
  assert.match(finalSubmissionBlock, /tagline/);
  assert.match(finalSubmissionBlock, /business_description/);
  assert.match(finalSubmissionBlock, /problem/);
  assert.match(finalSubmissionBlock, /ask/);
  assert.doesNotMatch(finalSubmissionBlock, /business_stage|industry/);
});

test('event recording actions stay disabled until a trusted session exists', () => {
  assert.match(studioSource, /disabled=\{Boolean\(eventSlug && !recordingSessionId\)\}/);
  assert.match(studioSource, /Retry recording setup/);
});

test('the pitch plan opens on a founder first visit without repeatedly interrupting practice', () => {
  assert.equal(shouldOpenPitchPlan(null), true);
  assert.equal(shouldOpenPitchPlan('1'), false);
});

test('new founders only need a valid one-line pitch', () => {
  const missing = validatePitchDetails({ hook: '', startupName: '', feedbackAsk: '', context: '' });
  assert.deepEqual(Object.keys(missing), ['hook']);

  assert.deepEqual(validatePitchDetails({
    hook: 'A clear one-line pitch for event reviewers.',
    startupName: '',
    feedbackAsk: '',
    context: '',
  }), {});
});

test('event submission retries prefer the stable public pitch identity', () => {
  assert.deepEqual(buildEventSubmissionBody({
    id: '6c3a220f-a5da-4ac9-aa9d-80c3a49aeefa',
    publicId: 'p_abc123def456',
    hook: 'A saved pitch',
  }), { pitchPublicId: 'p_abc123def456' });

  assert.equal(
    getEventSubmissionRetryKey('demo-day', 'founder-id'),
    'pitchinpublic:event-submission:founder-id:demo-day',
  );
});

test('submission response exposes the authoritative pitch identity', () => {
  assert.deepEqual(buildSubmissionSuccessResponse(
    { id: 'submission-id', status: 'submitted' },
    { id: 'pitch-id', public_id: 'p_abc123def456' },
  ), {
    success: true,
    submission: { id: 'submission-id', status: 'submitted' },
    pitchId: 'pitch-id',
    publicId: 'p_abc123def456',
    visibilityChanged: false,
  });
});
