import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDashboardHref,
  canManageEventInvites,
  classifyEventRole,
  founderMatchesFilter,
  getDashboardActionCounts,
  getDashboardPrimaryAction,
  getDeadlineState,
  getInvitationHealth,
  getInviteContinuationCounts,
  getNextFeedbackSubmission,
  isEventInviteExpired,
  parseBulkFounderEmails,
  parseDashboardState,
  parseEventListView,
  publicInviteDeliveryError,
  publicInviteError,
  resolveEventListView,
  scopePitchFeedbackToEvent,
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
  assert.deepEqual(parseDashboardState('?tab=overview&filter=needs-feedback'), { tab: 'overview', filter: null });
  assert.deepEqual(parseDashboardState('?tab=founders&filter=needs-feedback'), { tab: 'founders', filter: null });
});

test('builds one canonical dashboard URL with a matching panel anchor', () => {
  assert.equal(
    buildDashboardHref('/events/demo/dashboard', 'submissions', 'needs-feedback'),
    '/events/demo/dashboard?tab=submissions&filter=needs-feedback#dashboard-panel-submissions'
  );
  assert.equal(
    buildDashboardHref('/events/demo/dashboard', 'founders', 'needs-feedback'),
    '/events/demo/dashboard?tab=founders#dashboard-panel-founders'
  );
  assert.equal(buildDashboardHref('/events/demo/dashboard', 'overview'), '/events/demo/dashboard#dashboard-panel-overview');
});

test('prioritizes the single organizer action by founder value', () => {
  assert.deepEqual(
    getDashboardPrimaryAction({ activeFounderCount: 0, activeFounderInviteCount: 0, needsFeedback: 3, notSubmitted: 2 }),
    { kind: 'invite', label: 'Invite founders', tab: 'founders', filter: null }
  );
  assert.equal(getDashboardPrimaryAction({ activeFounderCount: 0, activeFounderInviteCount: 2, needsFeedback: 0, notSubmitted: 0 }).label, 'View invite status');
  assert.equal(getDashboardPrimaryAction({ activeFounderCount: 1, activeFounderInviteCount: 0, needsFeedback: 1, notSubmitted: 2 }).label, 'Review next pitch');
  assert.equal(getDashboardPrimaryAction({ activeFounderCount: 1, activeFounderInviteCount: 0, needsFeedback: 0, notSubmitted: 2 }).label, 'Follow up with 2 founders');
  assert.equal(getDashboardPrimaryAction({ activeFounderCount: 1, activeFounderInviteCount: 0, needsFeedback: 0, notSubmitted: 0 }).label, 'View submissions');
});

test('chooses the oldest uncovered submission with a stable public-id tie break', () => {
  const next = getNextFeedbackSubmission([
    { submitted_at: '2026-08-02T10:00:00Z', pitch_id: 'third', pitch: { public_id: 'p_cccccccccccc', feedback: [] } },
    { submitted_at: '2026-08-01T10:00:00Z', pitch_id: 'second', pitch: { public_id: 'p_bbbbbbbbbbbb', feedback: [] } },
    { submitted_at: '2026-08-01T10:00:00Z', pitch_id: 'first', pitch: { public_id: 'p_aaaaaaaaaaaa', feedback: [] } },
    { submitted_at: '2026-07-01T10:00:00Z', pitch_id: 'covered', pitch: { public_id: 'p_zzzzzzzzzzzz', feedback: [{}] } },
  ]);
  assert.equal(next?.pitch_id, 'first');
});

test('classifies event workspaces and accepts only supported event views', () => {
  assert.equal(classifyEventRole('founder'), 'joined');
  assert.equal(classifyEventRole('organizer'), 'managed');
  assert.equal(classifyEventRole('admin'), 'managed');
  assert.equal(classifyEventRole('coach'), 'team');
  assert.equal(classifyEventRole('judge'), 'team');
  assert.equal(parseEventListView('?view=managed'), 'managed');
  assert.equal(parseEventListView('?view=unknown'), null);
});

test('opens the event view with the most immediate role value', () => {
  assert.equal(resolveEventListView({
    requestedView: null,
    availableViews: ['joined', 'managed'],
    canCreateEvents: true,
    joinedCount: 1,
    teamCount: 0,
  }), 'managed');
  assert.equal(resolveEventListView({
    requestedView: null,
    availableViews: ['joined', 'team'],
    canCreateEvents: false,
    joinedCount: 0,
    teamCount: 1,
  }), 'team');
  assert.equal(resolveEventListView({
    requestedView: 'joined',
    availableViews: ['joined', 'team'],
    canCreateEvents: false,
    joinedCount: 0,
    teamCount: 1,
  }), 'joined');
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

test('event creation surfaces both invite creation and email delivery failures', () => {
  assert.deepEqual(
    getInviteContinuationCounts(true, { sent: 1, failed: 1, emailFailed: 3 }, 5),
    { invited: 1, failed: 4 }
  );
  assert.deepEqual(getInviteContinuationCounts(false, {}, 5), { invited: 0, failed: 5 });
});

test('event dashboards count only feedback completed for the current event', () => {
  const pitch = {
    id: 'pitch-1',
    feedback: [
      { id: 'feedback-event-a' },
      { id: 'feedback-event-b' },
      { id: 'feedback-global' },
    ],
  };

  assert.deepEqual(
    scopePitchFeedbackToEvent(pitch, new Set(['feedback-event-b'])),
    { id: 'pitch-1', feedback: [{ id: 'feedback-event-b' }] },
  );
});

test('every event visibility requires an invitation or access code to join', async () => {
  const { requiresEventInvitation } = await import('./event-settings');
  for (const visibility of ['private', 'unlisted', 'public', null, undefined, 'something-new']) {
    assert.equal(requiresEventInvitation(visibility as string), true, `${visibility} must not allow self-join`);
  }
});
