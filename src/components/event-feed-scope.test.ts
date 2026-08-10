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

test('browsing a cohort feed does NOT scope feedback to the event', () => {
  // Structured feedback on a private take requires a review assignment
  // (enforced by the feedback trigger), so the cohort feed never attaches an
  // event scope on its own — the rail hides the action instead.
  assert.deepEqual(
    buildFeedbackEventScope({ assignment: null, pitchPublicId: 'p_9' }),
    {},
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

test('an assignment for a different pitch never leaks its scope', () => {
  assert.deepEqual(
    buildFeedbackEventScope({
      assignment: { eventSlug: 'demo-day', publicPitchId: 'p_other' },
      pitchPublicId: 'p_1',
    }),
    {},
  );
});

test('the open feed sends no event scope', () => {
  assert.deepEqual(buildFeedbackEventScope({ pitchPublicId: 'p_1' }), {});
  assert.deepEqual(buildFeedbackEventScope({ assignment: null, pitchPublicId: null }), {});
});

test('feed scope changes reset position; identity-only changes do not', async () => {
  const { feedScopeChanged } = await import('./FullScreenVideoFeed');
  assert.equal(feedScopeChanged('', 'speed-networking'), true, 'open feed -> cohort feed resets');
  assert.equal(feedScopeChanged('speed-networking', ''), true, 'cohort feed -> open feed resets');
  assert.equal(feedScopeChanged('demo-day', 'speed-networking'), true, 'event -> event resets');
  assert.equal(feedScopeChanged('speed-networking', 'speed-networking'), false, 'same scope keeps position');
  assert.equal(feedScopeChanged('', ''), false, 'open feed refresh keeps position');
});
