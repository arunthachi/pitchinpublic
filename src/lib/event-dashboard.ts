export const DASHBOARD_TABS = ['overview', 'founders', 'submissions', 'team', 'announcements'] as const;
export type DashboardTab = (typeof DASHBOARD_TABS)[number];
export const PERSISTENT_DASHBOARD_TABS = ['overview', 'founders', 'submissions'] as const;

export const EVENT_LIST_VIEWS = ['joined', 'managed', 'team'] as const;
export type EventListView = (typeof EVENT_LIST_VIEWS)[number];

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

export function getInviteContinuationCounts(
  responseOk: boolean,
  data: { sent?: unknown; failed?: unknown; emailFailed?: unknown },
  requestedCount: number
) {
  if (!responseOk) return { invited: 0, failed: Math.max(0, requestedCount) };

  const invited = Math.max(0, Number(data.sent || 0));
  const failed = Math.max(0, Number(data.failed || 0)) + Math.max(0, Number(data.emailFailed || 0));
  return { invited, failed };
}

export function scopePitchFeedbackToEvent<T extends {
  feedback?: Array<{ id?: string | null }> | null;
}>(pitch: T, completedFeedbackIds: ReadonlySet<string>): T {
  return {
    ...pitch,
    feedback: (pitch.feedback || []).filter((item) => Boolean(item.id && completedFeedbackIds.has(item.id))),
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_BULK_FOUNDER_INVITES = 50;

const FILTER_TABS: Record<DashboardFilter, DashboardTab> = {
  'not-recorded': 'founders',
  'not-submitted': 'founders',
  'needs-feedback': 'submissions',
  'missing-best-take': 'founders',
};

export type DashboardPrimaryAction =
  | { kind: 'invite'; label: 'Invite founders'; tab: 'founders'; filter: null }
  | { kind: 'invite-status'; label: 'View invite status'; tab: 'founders'; filter: null }
  | { kind: 'review'; label: string; tab: 'submissions'; filter: 'needs-feedback' }
  | { kind: 'follow-up'; label: string; tab: 'founders'; filter: 'not-submitted' }
  | { kind: 'submissions'; label: 'View submissions'; tab: 'submissions'; filter: null };

export function parseEventListView(search: string): EventListView | null {
  const value = new URLSearchParams(search).get('view');
  return EVENT_LIST_VIEWS.includes(value as EventListView) ? (value as EventListView) : null;
}

export function classifyEventRole(role?: string | null): EventListView {
  if (role === 'organizer' || role === 'admin') return 'managed';
  if (role === 'coach' || role === 'mentor' || role === 'judge') return 'team';
  return 'joined';
}

export function parseDashboardState(search: string): { tab: DashboardTab; filter: DashboardFilter | null } {
  const params = new URLSearchParams(search);
  const tabValue = params.get('tab');
  const filterValue = params.get('filter');
  const tab = DASHBOARD_TABS.includes(tabValue as DashboardTab) ? (tabValue as DashboardTab) : 'overview';
  const candidateFilter = DASHBOARD_FILTERS.includes(filterValue as DashboardFilter)
    ? (filterValue as DashboardFilter)
    : null;
  const filter = candidateFilter && FILTER_TABS[candidateFilter] === tab ? candidateFilter : null;

  return { tab, filter };
}

export function buildDashboardHref(
  pathname: string,
  tab: DashboardTab,
  filter: DashboardFilter | null = null
) {
  const safeFilter = filter && FILTER_TABS[filter] === tab ? filter : null;
  const params = new URLSearchParams();
  if (tab !== 'overview') params.set('tab', tab);
  if (safeFilter) params.set('filter', safeFilter);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ''}#dashboard-panel-${tab}`;
}

export function getDashboardPrimaryAction(input: {
  activeFounderCount: number;
  activeFounderInviteCount: number;
  needsFeedback: number;
  notSubmitted: number;
}): DashboardPrimaryAction {
  if (input.activeFounderCount === 0 && input.activeFounderInviteCount === 0) {
    return { kind: 'invite', label: 'Invite founders', tab: 'founders', filter: null };
  }
  if (input.activeFounderCount === 0) {
    return { kind: 'invite-status', label: 'View invite status', tab: 'founders', filter: null };
  }
  if (input.needsFeedback > 0) {
    return {
      kind: 'review',
      label: input.needsFeedback === 1 ? 'Review next pitch' : `Review ${input.needsFeedback} pitches`,
      tab: 'submissions',
      filter: 'needs-feedback',
    };
  }
  if (input.notSubmitted > 0) {
    return {
      kind: 'follow-up',
      label: input.notSubmitted === 1 ? 'Follow up with 1 founder' : `Follow up with ${input.notSubmitted} founders`,
      tab: 'founders',
      filter: 'not-submitted',
    };
  }
  return { kind: 'submissions', label: 'View submissions', tab: 'submissions', filter: null };
}

export function getNextFeedbackSubmission<T extends {
  submitted_at?: string | null;
  created_at?: string | null;
  pitch_id?: string | null;
  pitch?: { public_id?: string | null; feedback?: unknown[] | null } | null;
}>(submissions: T[]) {
  return submissions
    .filter((submission) => submissionMatchesFilter(submission, 'needs-feedback'))
    .sort((left, right) => {
      const leftTime = new Date(left.submitted_at || left.created_at || 0).getTime();
      const rightTime = new Date(right.submitted_at || right.created_at || 0).getTime();
      if (leftTime !== rightTime) return leftTime - rightTime;
      const leftId = left.pitch?.public_id || left.pitch_id || '';
      const rightId = right.pitch?.public_id || right.pitch_id || '';
      return leftId.localeCompare(rightId);
    })[0] || null;
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
