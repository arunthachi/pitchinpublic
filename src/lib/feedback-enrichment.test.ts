import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attachFeedbackAvailability,
  availableFeedback,
  resolveFeedbackQuery,
} from './feedback-enrichment';

test('groups successful feedback by pitch and marks genuine empty results available', () => {
  const resolved = resolveFeedbackQuery({
    data: [
      { id: 'f-1', pitch_id: 'p-1' },
      { id: 'f-2', pitch_id: 'p-1' },
      { id: 'f-3', pitch_id: 'p-2' },
    ],
    error: null,
  });

  assert.equal(resolved.feedbackState, 'available');
  if (resolved.feedbackState === 'available') {
    assert.deepEqual(resolved.feedbackByPitch.get('p-1')?.map((row) => row.id), ['f-1', 'f-2']);
  }

  assert.deepEqual(
    attachFeedbackAvailability({ id: 'p-empty' }, availableFeedback()),
    { id: 'p-empty', feedbackState: 'available', feedback: [] },
  );
});

test('preserves a base pitch and omits feedback when enrichment fails', () => {
  const databaseError = { code: '42501', message: 'permission denied for table feedback' };
  const resolved = resolveFeedbackQuery({ data: null, error: databaseError });
  const pitch = attachFeedbackAvailability(
    { id: 'p-1', hook: 'Still visible', feedback: [{ id: 'stale' }] },
    resolved,
  );

  assert.deepEqual(resolved, { feedbackState: 'unavailable', error: databaseError });
  assert.deepEqual(pitch, { id: 'p-1', hook: 'Still visible', feedbackState: 'unavailable' });
  assert.equal('feedback' in pitch, false);
});

test('treats a null success payload as unavailable instead of a false empty result', () => {
  const resolved = resolveFeedbackQuery({ data: null, error: null });
  assert.equal(resolved.feedbackState, 'unavailable');
  if (resolved.feedbackState === 'unavailable') {
    assert.match(String(resolved.error), /returned no data/);
  }
});
