import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attachFeedbackAvailability,
  availableFeedback,
  FOUNDER_FEEDBACK_RPC_MAX_PITCH_IDS,
  loadFeedbackInBatches,
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

test('loads large events in bounded feedback batches without dropping pitches', async () => {
  const pitchIds = Array.from({ length: 205 }, (_, index) => `p-${index + 1}`);
  const batches: string[][] = [];
  const resolved = await loadFeedbackInBatches(pitchIds, async (batch) => {
    batches.push(batch);
    return {
      data: batch.map((pitch_id) => ({ id: `f-${pitch_id}`, pitch_id })),
      error: null,
    };
  });

  assert.deepEqual(batches.map((batch) => batch.length), [50, 50, 50, 50, 5]);
  assert.equal(batches.every((batch) => batch.length <= FOUNDER_FEEDBACK_RPC_MAX_PITCH_IDS), true);
  assert.equal(resolved.feedbackState, 'available');
  if (resolved.feedbackState === 'available') {
    assert.equal(resolved.feedbackByPitch.size, 205);
    assert.equal(resolved.feedbackByPitch.get('p-205')?.[0]?.id, 'f-p-205');
  }
});

test('rejects a batch size above the database RPC contract', async () => {
  let called = false;
  const resolved = await loadFeedbackInBatches(
    ['p-1'],
    async () => {
      called = true;
      return { data: [], error: null };
    },
    FOUNDER_FEEDBACK_RPC_MAX_PITCH_IDS + 1,
  );

  assert.equal(called, false);
  assert.equal(resolved.feedbackState, 'unavailable');
  if (resolved.feedbackState === 'unavailable') {
    assert.match(String(resolved.error), /between 1 and 50/);
  }
});

test('marks the whole enrichment unavailable when any feedback batch fails', async () => {
  let calls = 0;
  const failure = { code: '42501', message: 'permission denied' };
  const resolved = await loadFeedbackInBatches(
    Array.from({ length: 101 }, (_, index) => `p-${index + 1}`),
    async (batch) => {
      calls += 1;
      return calls === 1
        ? { data: batch.map((pitch_id) => ({ pitch_id })), error: null }
        : { data: null, error: failure };
    },
  );

  assert.equal(calls, 2);
  assert.deepEqual(resolved, { feedbackState: 'unavailable', error: failure });
});
