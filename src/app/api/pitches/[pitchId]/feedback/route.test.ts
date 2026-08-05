import assert from 'node:assert/strict';
import test from 'node:test';
import * as feedbackRoute from './route';

const { canGiveEventFeedback } = feedbackRoute;

test('event owners can give feedback without a duplicate participant row', () => {
  assert.equal(canGiveEventFeedback('owner', 'owner', null), true);
});

test('only active event-team roles can give event-scoped feedback', () => {
  for (const role of ['organizer', 'admin', 'coach', 'mentor', 'judge']) {
    assert.equal(canGiveEventFeedback('owner', 'reviewer', { role, status: 'active' }), true, role);
  }

  assert.equal(canGiveEventFeedback('owner', 'reviewer', { role: 'founder', status: 'active' }), false);
  assert.equal(canGiveEventFeedback('owner', 'reviewer', { role: 'judge', status: 'pending' }), false);
  assert.equal(canGiveEventFeedback('owner', 'reviewer', null), false);
});

test('feedback route keeps event authorization on POST and exposes no destructive handler', () => {
  assert.equal(typeof feedbackRoute.POST, 'function');
  assert.equal(Reflect.has(feedbackRoute, 'DELETE'), false);
});
