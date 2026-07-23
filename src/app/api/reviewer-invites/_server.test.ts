import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hashReviewerInviteToken,
  isValidReviewerInviteToken,
  ReviewerInvitationError,
  reviewerInvitationErrorResponse,
} from '@/lib/reviewer-invitations';

test('reviewer invitation tokens are hashed deterministically without retaining the token', () => {
  const token = 'a'.repeat(43);
  const hash = hashReviewerInviteToken(token);

  assert.equal(hash.length, 64);
  assert.equal(hash, hashReviewerInviteToken(token));
  assert.notEqual(hash, token);
});

test('reviewer invitation token validation accepts only bounded base64url values', () => {
  assert.equal(isValidReviewerInviteToken('Abc_123-'.repeat(4)), true);
  assert.equal(isValidReviewerInviteToken('short'), false);
  assert.equal(isValidReviewerInviteToken('a'.repeat(257)), false);
  assert.equal(isValidReviewerInviteToken(`${'a'.repeat(31)}!`), false);
});

test('reviewer invitation errors preserve safe status, code, and details', () => {
  const response = reviewerInvitationErrorResponse(
    new ReviewerInvitationError('Wait before retrying.', 429, 'rate_limited', {
      retryAfter: 60,
    })
  );

  assert.deepEqual(response, {
    status: 429,
    body: {
      success: false,
      error: 'Wait before retrying.',
      code: 'rate_limited',
      retryAfter: 60,
    },
  });
});
