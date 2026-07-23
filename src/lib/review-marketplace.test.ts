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
          pitch_id: 'internal-db-id',
          public_pitch_id: 'p_public123',
          startup_name: 'Acme',
          status: 'started',
        },
      ],
    },
  });

  assert.equal(queue?.items.length, 1);
  assert.equal(queue?.items[0].publicPitchId, 'p_public123');
  assert.equal(queue?.items[0].pitchId, 'internal-db-id');
});
