import assert from 'node:assert/strict';
import test from 'node:test';
import { countEventFeedback, groupEventTakeFeedback, reviewerRoleLabel } from './event-feedback';

const EVENT = 'event-1';
const ME = 'me';

const pitches = [
  {
    id: 'p1',
    public_id: 'pub1',
    user_id: ME,
    event_id: EVENT,
    hook: 'First take',
    take_version: 1,
    created_at: '2026-08-01T10:00:00Z',
    feedback: [
      { id: 'f1', type: 'roast', content: 'Tighten the ask', reviewer_role: 'mentor', created_at: '2026-08-02T10:00:00Z' },
      { id: 'f2', type: 'toast', content: 'Clear problem', reviewer_role: 'peer_founder', created_at: '2026-08-03T10:00:00Z' },
    ],
  },
  {
    id: 'p2',
    public_id: 'pub2',
    user_id: ME,
    event_id: EVENT,
    hook: 'Second take',
    take_version: 2,
    created_at: '2026-08-05T10:00:00Z',
    feedback: [],
  },
  { id: 'p3', user_id: ME, event_id: 'other-event', hook: 'Other event', feedback: [{ id: 'f3' }] },
  { id: 'p4', user_id: 'someone-else', event_id: EVENT, hook: 'Peer take', feedback: [{ id: 'f4' }] },
  { id: 'p5', user_id: ME, event_id: null, hook: 'Feed take', feedback: [{ id: 'f5' }] },
];

test('reviewer roles map to founder-readable labels', () => {
  assert.equal(reviewerRoleLabel('mentor'), 'Mentor');
  assert.equal(reviewerRoleLabel('judge'), 'Judge');
  assert.equal(reviewerRoleLabel('peer_founder'), 'Peer');
  assert.equal(reviewerRoleLabel('trusted_reviewer'), 'Trusted reviewer');
  assert.equal(reviewerRoleLabel(null), 'Reviewer');
  assert.equal(reviewerRoleLabel('something_new'), 'Reviewer');
});

test('only the viewer own takes for this event are grouped', () => {
  const takes = groupEventTakeFeedback(pitches, { eventId: EVENT, viewerId: ME, submittedPitchId: 'p2' });
  assert.deepEqual(takes.map((take) => take.pitchId), ['p2', 'p1'], 'newest take first');
  assert.equal(takes.some((take) => take.pitchId === 'p3'), false, 'other events excluded');
  assert.equal(takes.some((take) => take.pitchId === 'p4'), false, "other founders' takes excluded");
  assert.equal(takes.some((take) => take.pitchId === 'p5'), false, 'non-event takes excluded');
});

test('feedback is newest-first with role labels, and the submitted take is flagged', () => {
  const takes = groupEventTakeFeedback(pitches, { eventId: EVENT, viewerId: ME, submittedPitchId: 'p2' });
  const first = takes.find((take) => take.pitchId === 'p1');
  assert.deepEqual(first?.feedback.map((entry) => entry.id), ['f2', 'f1']);
  assert.deepEqual(first?.feedback.map((entry) => entry.roleLabel), ['Peer', 'Mentor']);
  assert.equal(first?.takeLabel, 'Take 1');
  assert.equal(takes.find((take) => take.pitchId === 'p2')?.isSubmitted, true);
  assert.equal(first?.isSubmitted, false);
});

test('missing context yields nothing rather than leaking everything', () => {
  assert.deepEqual(groupEventTakeFeedback(pitches, { eventId: null, viewerId: ME }), []);
  assert.deepEqual(groupEventTakeFeedback(pitches, { eventId: EVENT, viewerId: null }), []);
  assert.deepEqual(groupEventTakeFeedback(null, { eventId: EVENT, viewerId: ME }), []);
});

test('feedback count totals across takes', () => {
  const takes = groupEventTakeFeedback(pitches, { eventId: EVENT, viewerId: ME });
  assert.equal(countEventFeedback(takes), 2);
  assert.equal(countEventFeedback([]), 0);
});
