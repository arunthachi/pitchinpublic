import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEventSubmissionBody } from './RecordingStudio';
import { validatePitchDetails } from './Step2_AddDetails';
import { buildSubmissionSuccessResponse } from '../app/api/events/[slug]/submission/route';
import { getEventSubmissionRetryKey } from '@/lib/idempotency';

test('returning founders can submit with saved one-line pitch and no optional fields', () => {
  assert.deepEqual(validatePitchDetails({
    hook: 'We help early founders explain their product clearly.',
    startupName: '',
    feedbackAsk: '',
    context: '',
  }), {});
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
