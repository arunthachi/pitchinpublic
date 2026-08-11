import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFeedbackEventScope, canComposeFeedback } from './FullScreenVideoFeed';

test('assigned review feedback carries the assignment event', () => {
  assert.deepEqual(
    buildFeedbackEventScope({
      assignment: { eventSlug: 'demo-day', publicPitchId: 'p_1' },
      pitchPublicId: 'p_1',
    }),
    { eventSlug: 'demo-day' },
  );
});

test('browsing a cohort feed scopes feedback to that event', () => {
  // Membership is the authorisation boundary, so peer feedback must name the
  // event it was given in — without the slug the server sees unscoped feedback
  // on a private pitch and rejects it.
  assert.deepEqual(
    buildFeedbackEventScope({ assignment: null, pitchPublicId: 'p_9', feedEventSlug: 'speed-networking' }),
    { eventSlug: 'speed-networking' },
  );
});

test('the open feed carries no event scope', () => {
  assert.deepEqual(buildFeedbackEventScope({ assignment: null, pitchPublicId: 'p_9' }), {});
  assert.deepEqual(
    buildFeedbackEventScope({ assignment: null, pitchPublicId: 'p_9', feedEventSlug: null }),
    {},
  );
});

test('an assignment for this pitch wins over the feed it was opened from', () => {
  // A reviewer can browse one cohort while holding an assignment allocated
  // against another event; the review belongs to the event that allocated it.
  assert.deepEqual(
    buildFeedbackEventScope({
      assignment: { eventSlug: 'demo-day', publicPitchId: 'p_1' },
      pitchPublicId: 'p_1',
      feedEventSlug: 'speed-networking',
    }),
    { eventSlug: 'demo-day' },
  );
});

test('an assignment for a different pitch never leaks its scope', () => {
  assert.deepEqual(
    buildFeedbackEventScope({
      assignment: { eventSlug: 'demo-day', publicPitchId: 'p_other' },
      pitchPublicId: 'p_1',
    }),
    {},
  );
  // ...and the feed's own event is used instead when there is one.
  assert.deepEqual(
    buildFeedbackEventScope({
      assignment: { eventSlug: 'demo-day', publicPitchId: 'p_other' },
      pitchPublicId: 'p_1',
      feedEventSlug: 'speed-networking',
    }),
    { eventSlug: 'speed-networking' },
  );
});

test('the open feed always allows composing', () => {
  assert.equal(canComposeFeedback(null, null, 'p_1'), true);
  assert.equal(canComposeFeedback(null, null, 'p_1', false), true);
});

test('a cohort member may compose without an assignment', () => {
  // This is the whole point of the slice: peer founders could already WATCH
  // these takes, so they may respond to them.
  assert.equal(canComposeFeedback('speed-networking', null, 'p_1', true), true);
});

test('an unloaded peer-feedback flag is treated as allowed', () => {
  // The server is the authority. Hiding the action on a slow response is worse
  // than a rare rejected submit.
  assert.equal(canComposeFeedback('speed-networking', null, 'p_1', undefined), true);
});

test('an organizer can close peer feedback for a competition', () => {
  assert.equal(canComposeFeedback('speed-networking', null, 'p_1', false), false);
});

test('an assigned reviewer still composes where peer feedback is off', () => {
  // Turning off peer review must not disarm the organizer's own review queue.
  assert.equal(
    canComposeFeedback('speed-networking', { publicPitchId: 'p_1' }, 'p_1', false),
    true,
  );
  // ...but only for the pitch they were actually assigned.
  assert.equal(
    canComposeFeedback('speed-networking', { publicPitchId: 'p_other' }, 'p_1', false),
    false,
  );
});
