import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canManageEventInvites,
  founderMatchesFilter,
  getDashboardActionCounts,
  getDeadlineState,
  getInvitationHealth,
  isEventInviteExpired,
  parseBulkFounderEmails,
  parseDashboardState,
  publicInviteDeliveryError,
  publicInviteError,
  submissionMatchesFilter,
} from './event-dashboard';

const now = new Date('2026-08-01T12:00:00.000Z');

test('counts active founder actions and uncovered submissions', () => {
  const founders = [
    { status: 'active', recorded: false, submitted: false, hasBestTake: false, feedbackCount: 0 },
    { status: 'active', recorded: true, submitted: true, hasBestTake: false, feedbackCount: 0 },
    { status: 'removed', recorded: false, submitted: false, hasBestTake: false, feedbackCount: 0 },
  ];
  const submissions = [{ pitch: { feedback: [] } }, { pitch: { feedback: [{}] } }];

  assert.deepEqual(getDashboardActionCounts(founders, submissions), {
    notRecorded: 1,
    notSubmitted: 1,
    needsFeedback: 1,
    missingBestTake: 2,
  });
});

test('matches founder and submission direct-action filters', () => {
  const founder = { status: 'active', recorded: true, submitted: true, hasBestTake: false, feedbackCount: 0 };
  assert.equal(founderMatchesFilter(founder, 'not-recorded'), false);
  assert.equal(founderMatchesFilter(founder, 'needs-feedback'), true);
  assert.equal(founderMatchesFilter(founder, 'missing-best-take'), true);
  assert.equal(founderMatchesFilter({ ...founder, status: 'removed' }, 'missing-best-take'), false);
  assert.equal(submissionMatchesFilter({ pitch: { feedback: [] } }, 'needs-feedback'), true);
  assert.equal(submissionMatchesFilter({ pitch: { feedback: [{}] } }, 'needs-feedback'), false);
});

test('parses only supported dashboard URL state', () => {
  assert.deepEqual(parseDashboardState('?tab=founders&filter=not-recorded'), {
    tab: 'founders',
    filter: 'not-recorded',
  });
  assert.deepEqual(parseDashboardState('?tab=secrets&filter=all'), { tab: 'overview', filter: null });
});

test('formats deadline states without hiding passed deadlines', () => {
  assert.deepEqual(getDeadlineState(null, now), { state: 'unset', label: 'No deadline', daysRemaining: null });
  assert.deepEqual(getDeadlineState('2026-08-02T12:00:00.000Z', now), { state: 'upcoming', label: '1 day left', daysRemaining: 1 });
  assert.deepEqual(getDeadlineState('2026-07-31T12:00:00.000Z', now), { state: 'passed', label: 'Deadline passed', daysRemaining: 0 });
});

test('invitation lifecycle takes precedence over delivery and derives expiry', () => {
  assert.equal(getInvitationHealth({ status: 'accepted', expires_at: '2026-07-01', email_status: 'failed' }, now).lifecycle, 'accepted');
  assert.equal(getInvitationHealth({ status: 'revoked', expires_at: '2026-09-01' }, now).lifecycle, 'revoked');
  const expired = getInvitationHealth({ status: 'pending', expires_at: '2026-07-31', email_status: 'sent' }, now);
  assert.equal(expired.lifecycle, 'expired');
  assert.equal(expired.canResend, true);
  assert.equal(expired.canRevoke, true);
  assert.equal(isEventInviteExpired({ status: 'pending', expires_at: '2026-07-31' }, now), true);
  assert.equal(isEventInviteExpired({ status: 'accepted', expires_at: '2026-07-31' }, now), false);
});

test('preserves organizer/admin mutation authorization and read-only team access', () => {
  assert.equal(canManageEventInvites('owner', 'owner', null), true);
  assert.equal(canManageEventInvites('owner', 'admin-user', { role: 'admin', status: 'active' }), true);
  assert.equal(canManageEventInvites('owner', 'coach-user', { role: 'coach', status: 'active' }), false);
  assert.equal(canManageEventInvites('owner', 'removed-admin', { role: 'admin', status: 'removed' }), false);
});

test('bulk founder parsing normalizes, deduplicates, validates, and caps addresses', () => {
  const parsed = parseBulkFounderEmails('A@example.com, a@example.com\nb@example.com invalid');
  assert.deepEqual(parsed.emails, ['a@example.com', 'b@example.com']);
  assert.deepEqual(parsed.invalid, ['invalid']);
  assert.equal(parsed.duplicateCount, 1);

  const capped = parseBulkFounderEmails(
    Array.from({ length: 52 }, (_, index) => `founder${index}@example.com`).join('\n')
  );
  assert.equal(capped.emails.length, 50);
  assert.equal(capped.overflow, 2);
});

test('public invitation errors do not expose provider or database internals', () => {
  assert.equal(publicInviteError('create'), 'Could not create the invite. Please try again.');
  assert.equal(publicInviteDeliveryError('failed'), 'Email delivery failed. Retry or copy the invite link to send it manually.');
  assert.equal(publicInviteDeliveryError('sent'), null);
});
