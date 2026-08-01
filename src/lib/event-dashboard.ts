export const DASHBOARD_TABS = ['overview', 'founders', 'submissions', 'team', 'announcements'] as const;
export type DashboardTab = (typeof DASHBOARD_TABS)[number];

export const DASHBOARD_FILTERS = ['not-recorded', 'not-submitted', 'needs-feedback', 'missing-best-take'] as const;
export type DashboardFilter = (typeof DASHBOARD_FILTERS)[number];

export type FounderActionState = {
  status?: string | null;
  recorded: boolean;
  submitted: boolean;
  hasBestTake: boolean;
  feedbackCount: number;
};

export type SubmissionActionState = {
  pitch?: {
    feedback?: unknown[] | null;
  } | null;
};

export type InvitationHealth = {
  lifecycle: 'pending' | 'accepted' | 'revoked' | 'expired';
  lifecycleLabel: string;
  delivery: 'unknown' | 'skipped' | 'sent' | 'failed' | 'not_configured';
  canResend: boolean;
  canRevoke: boolean;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_BULK_FOUNDER_INVITES = 50;

export function parseDashboardState(search: string): { tab: DashboardTab; filter: DashboardFilter | null } {
  const params = new URLSearchParams(search);
  const tabValue = params.get('tab');
  const filterValue = params.get('filter');
  const tab = DASHBOARD_TABS.includes(tabValue as DashboardTab) ? (tabValue as DashboardTab) : 'overview';
  const filter = DASHBOARD_FILTERS.includes(filterValue as DashboardFilter)
    ? (filterValue as DashboardFilter)
    : null;

  return { tab, filter };
}

export function founderMatchesFilter(founder: FounderActionState, filter: DashboardFilter | null) {
  if (!filter) return true;
  if (founder.status === 'removed') return false;
  if (filter === 'not-recorded') return !founder.recorded;
  if (filter === 'not-submitted') return !founder.submitted;
  if (filter === 'missing-best-take') return !founder.hasBestTake;
  return founder.submitted && founder.feedbackCount === 0;
}

export function submissionMatchesFilter(submission: SubmissionActionState, filter: DashboardFilter | null) {
  if (filter !== 'needs-feedback') return true;
  return (submission.pitch?.feedback?.length || 0) === 0;
}

export function getDashboardActionCounts(founders: FounderActionState[], submissions: SubmissionActionState[]) {
  const activeFounders = founders.filter((founder) => founder.status !== 'removed');
  return {
    notRecorded: activeFounders.filter((founder) => !founder.recorded).length,
    notSubmitted: activeFounders.filter((founder) => !founder.submitted).length,
    needsFeedback: submissions.filter((submission) => submissionMatchesFilter(submission, 'needs-feedback')).length,
    missingBestTake: activeFounders.filter((founder) => !founder.hasBestTake).length,
  };
}

export function getDeadlineState(value?: string | null, now = new Date()) {
  if (!value) return { state: 'unset' as const, label: 'No deadline', daysRemaining: null };
  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) return { state: 'unset' as const, label: 'No deadline', daysRemaining: null };

  const millisecondsRemaining = deadline.getTime() - now.getTime();
  if (millisecondsRemaining <= 0) return { state: 'passed' as const, label: 'Deadline passed', daysRemaining: 0 };

  const daysRemaining = Math.ceil(millisecondsRemaining / 86_400_000);
  return {
    state: 'upcoming' as const,
    label: daysRemaining === 1 ? '1 day left' : `${daysRemaining} days left`,
    daysRemaining,
  };
}

export function getInvitationHealth(
  invitation: { status?: string | null; expires_at?: string | null; email_status?: string | null },
  now = new Date()
): InvitationHealth {
  const expiresAt = invitation.expires_at ? new Date(invitation.expires_at).getTime() : Number.POSITIVE_INFINITY;
  const lifecycle = invitation.status === 'accepted'
    ? 'accepted'
    : invitation.status === 'revoked'
      ? 'revoked'
      : Number.isFinite(expiresAt) && expiresAt <= now.getTime()
        ? 'expired'
        : 'pending';
  const deliveryValues: InvitationHealth['delivery'][] = ['unknown', 'skipped', 'sent', 'failed', 'not_configured'];
  const delivery = deliveryValues.includes(invitation.email_status as InvitationHealth['delivery'])
    ? invitation.email_status as InvitationHealth['delivery']
    : 'unknown';

  return {
    lifecycle,
    lifecycleLabel: lifecycle.charAt(0).toUpperCase() + lifecycle.slice(1),
    delivery,
    canResend: lifecycle === 'pending' || lifecycle === 'expired',
    canRevoke: lifecycle === 'pending' || lifecycle === 'expired',
  };
}

export function isEventInviteExpired(invitation: { status?: string | null; expires_at?: string | null }, now = new Date()) {
  return getInvitationHealth(invitation, now).lifecycle === 'expired';
}

export function parseBulkFounderEmails(value: string, limit = MAX_BULK_FOUNDER_INVITES) {
  const entries = value
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(entries)];
  const valid = unique.filter((email) => EMAIL_PATTERN.test(email));
  const invalid = unique.filter((email) => !EMAIL_PATTERN.test(email));

  return {
    emails: valid.slice(0, limit),
    invalid,
    overflow: Math.max(0, valid.length - limit),
    duplicateCount: entries.length - unique.length,
  };
}

export function publicInviteError(operation: 'create' | 'resend' | 'revoke' = 'create') {
  if (operation === 'resend') return 'Could not resend the invite. Please try again.';
  if (operation === 'revoke') return 'Could not revoke the invite. Please try again.';
  return 'Could not create the invite. Please try again.';
}

export function publicInviteDeliveryError(status?: string | null) {
  if (status === 'not_configured') return 'Email delivery is not configured. Copy the invite link to send it manually.';
  if (status === 'failed') return 'Email delivery failed. Retry or copy the invite link to send it manually.';
  return null;
}

export function canManageEventInvites(
  eventOrganizerId: string,
  userId: string,
  participant?: { role?: string | null; status?: string | null } | null
) {
  return eventOrganizerId === userId || (
    participant?.status === 'active' && ['organizer', 'admin'].includes(participant.role || '')
  );
}
