import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFeedbackEventScope } from './FullScreenVideoFeed';

test('assigned review feedback carries the assignment event', () => {
  assert.deepEqual(
    buildFeedbackEventScope({
      assignment: { eventSlug: 'demo-day', publicPitchId: 'p_1' },
      pitchPublicId: 'p_1',
    }),
    { eventSlug: 'demo-day' },
  );
});

test('cohort feed feedback carries the feed event', () => {
  assert.deepEqual(
    buildFeedbackEventScope({ assignment: null, pitchPublicId: 'p_9', feedEventSlug: 'speed-networking' }),
    { eventSlug: 'speed-networking' },
  );
});

test('an assignment for a different pitch does not leak its event', () => {
  assert.deepEqual(
    buildFeedbackEventScope({
      assignment: { eventSlug: 'demo-day', publicPitchId: 'p_other' },
      pitchPublicId: 'p_1',
    }),
    {},
  );
});

test('an assignment for a different pitch still falls back to the feed event', () => {
  assert.deepEqual(
    buildFeedbackEventScope({
      assignment: { eventSlug: 'demo-day', publicPitchId: 'p_other' },
      pitchPublicId: 'p_1',
      feedEventSlug: 'speed-networking',
    }),
    { eventSlug: 'speed-networking' },
  );
});

test('the open feed sends no event scope', () => {
  assert.deepEqual(buildFeedbackEventScope({ pitchPublicId: 'p_1' }), {});
  assert.deepEqual(buildFeedbackEventScope({ assignment: null, pitchPublicId: null, feedEventSlug: null }), {});
});
