import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  FEEDBACK_HISTORY_RPC,
  parseFeedbackHistoryQuery,
  serializeFeedbackHistory,
  type FeedbackHistoryRow,
} from './_server';

const routeSource = readFileSync(new URL('./route.ts', import.meta.url), 'utf8');

const baseRow: FeedbackHistoryRow = {
  feedback_id: '00000000-0000-4000-8000-000000000001',
  pitch_id: '00000000-0000-4000-8000-000000000002',
  pitch_available: true,
  pitch_public_id: 'pitch-one',
  pitch_hook: 'A clear hook',
  startup_name: 'Acme',
  feedback_type: 'toast',
  feedback_content: JSON.stringify({ notes: 'Strong opening.' }),
  reviewer_role: 'peer_founder',
  criterion_key: 'clarity',
  observation: 'The problem is concrete.',
  next_step: 'Add one market number.',
  created_at: '2026-08-29T01:00:00.000Z',
};

test('history query requires the stable cursor fields as a pair', () => {
  assert.equal(parseFeedbackHistoryQuery(new URLSearchParams()).success, true);
  assert.equal(parseFeedbackHistoryQuery(new URLSearchParams({ beforeCreatedAt: baseRow.created_at })).success, false);
  assert.equal(parseFeedbackHistoryQuery(new URLSearchParams({ beforeId: baseRow.feedback_id })).success, false);
  assert.equal(parseFeedbackHistoryQuery(new URLSearchParams({
    beforeCreatedAt: baseRow.created_at,
    beforeId: baseRow.feedback_id,
  })).success, true);
});

test('history serialization strips inaccessible pitch metadata and returns a stable cursor', () => {
  const unavailableRow = {
    ...baseRow,
    feedback_id: '00000000-0000-4000-8000-000000000003',
    pitch_available: false,
    pitch_hook: 'Must not leak',
    startup_name: 'Must not leak',
    created_at: '2026-08-28T01:00:00.000Z',
  };
  const result = serializeFeedbackHistory([baseRow, unavailableRow], 1);

  assert.deepEqual(result.nextCursor, {
    beforeCreatedAt: baseRow.created_at,
    beforeId: baseRow.feedback_id,
  });
  assert.equal(result.items[0]?.pitch.available, true);

  const unavailable = serializeFeedbackHistory([unavailableRow], 20);
  assert.deepEqual(unavailable.items[0]?.pitch, {
    available: false,
    id: null,
    publicId: null,
    hook: null,
    startupName: null,
  });
});

test('history route authenticates the caller and uses the self-only RPC', () => {
  assert.equal(FEEDBACK_HISTORY_RPC, 'get_my_feedback_history');
  assert.match(routeSource, /supabase\.auth\.getUser\(\)/);
  assert.match(routeSource, /supabase\.rpc\(FEEDBACK_HISTORY_RPC/);
  assert.doesNotMatch(routeSource, /userId/);
});
