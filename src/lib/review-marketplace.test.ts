import assert from 'node:assert/strict';
import test from 'node:test';
import {
  feedbackReviewerDisplay,
  normalizeLegacyFeedback,
  normalizeReviewerRole,
  normalizeReviewQueue,
  reviewerRoleLabel,
} from './review-marketplace';

test('normalizes reviewer role aliases without elevating unknown roles', () => {
  assert.equal(normalizeReviewerRole('founder'), 'peer_founder');
  assert.equal(normalizeReviewerRole('experienced reviewer'), 'experienced_reviewer');
  assert.equal(normalizeReviewerRole('trusted-reviewer'), 'trusted_reviewer');
  assert.equal(normalizeReviewerRole('platform_admin'), null);
  assert.equal(reviewerRoleLabel('platform_admin'), 'Reviewer');
});

test('shows trusted reviewer credentials while respecting role-only display', () => {
  const feedback = normalizeLegacyFeedback({
    id: 'feedback-public-id',
    author_name: 'Private Name',
    reviewer_role: 'trusted_reviewer',
    display_role_only: true,
    reviewer_badge: {
      title: 'Partner',
      organization: 'Example Ventures',
      expertise: ['fundraising', 'market'],
    },
    type: 'toast',
    content: JSON.stringify({ signals: ['Clear'], readiness: 'strong' }),
  });

  assert.deepEqual(feedbackReviewerDisplay(feedback), {
    name: 'Trusted reviewer',
    role: 'Partner · Example Ventures',
    expertise: ['fundraising', 'market'],
  });
});

test('rejects external quality action URLs', () => {
  const feedback = normalizeLegacyFeedback({
    id: 'feedback-public-id',
    type: 'roast',
    quality: {
      can_vote: true,
      action: { href: 'https://malicious.example/rate', method: 'POST' },
    },
  });

  assert.equal(feedback.canRateQuality, false);
  assert.equal(feedback.qualityAction, null);
});

test('requires public pitch identifiers for review queue navigation', () => {
  const queue = normalizeReviewQueue({
    queue: {
      items: [
        { pitch_id: 'internal-db-id-only', status: 'pending' },
        {
          id: 'assignment-a',
          pitch_id: 'internal-db-id',
          public_pitch_id: 'p_public123',
          startup_name: 'Acme',
          status: 'started',
          event: { slug: 'demo-event', name: 'Demo event' },
        },
      ],
    },
  });

  assert.equal(queue?.items.length, 1);
  assert.equal(queue?.items[0].publicPitchId, 'p_public123');
  assert.equal(queue?.items[0].pitchId, 'internal-db-id');
  assert.equal(queue?.items[0].assignmentId, 'assignment-a');
  assert.equal(queue?.items[0].eventSlug, 'demo-event');
});

test('keeps two event assignments for the same pitch independently actionable', () => {
  const queue = normalizeReviewQueue({
    assignments: [
      { id: 'assignment-a', status: 'pending', pitch: { publicId: 'p_samepitch' }, event: { slug: 'event-a' } },
      { id: 'assignment-b', status: 'started', pitch: { publicId: 'p_samepitch' }, event: { slug: 'event-b' } },
    ],
  });

  assert.deepEqual(
    queue?.items.map((item) => [item.assignmentId, item.publicPitchId, item.eventSlug]),
    [
      ['assignment-a', 'p_samepitch', 'event-a'],
      ['assignment-b', 'p_samepitch', 'event-b'],
    ],
  );
});

test('rejects unknown assignment states instead of making them actionable', () => {
  assert.throws(
    () => normalizeReviewQueue({
      assignments: [
        { id: 'assignment-a', status: 'future_state', pitch: { publicId: 'p_pitch' } },
      ],
    }),
    /Unknown review assignment status: future_state/,
  );
});

test('recognizes invalidated assignments without treating them as pending', () => {
  const queue = normalizeReviewQueue({
    assignments: [
      { id: 'assignment-a', status: 'invalidated', pitch: { publicId: 'p_pitch' } },
    ],
    pendingCount: 0,
  });

  assert.equal(queue?.items[0].status, 'invalidated');
  assert.equal(queue?.pendingCount, 0);
});
