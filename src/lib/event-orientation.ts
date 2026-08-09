/**
 * Pure helpers for founder-facing event orientation: card status chips and
 * the home-surface ribbon. Kept free of I/O so they are unit-testable.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export function deadlineCountdown(
  deadline: string | null | undefined,
  now: Date = new Date()
): string | null {
  if (!deadline) return null;
  const value = /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? `${deadline}T23:59:59` : deadline;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return null;

  const days = Math.floor((due.getTime() - now.getTime()) / DAY_MS);
  if (days < 0) return 'past due';
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  return `due in ${days}d`;
}

export type EventStatusChip = {
  label: string;
  tone: 'ready' | 'warn' | 'muted';
};

/**
 * Founder card chip. Non-founder roles get no submission chip (they do not
 * submit takes), and an event with neither a submission nor a deadline shows
 * a plain not-submitted state.
 */
export function founderEventStatusChip(
  input: {
    role?: string | null;
    mySubmission?: boolean | null;
    submissionDeadline?: string | null;
  },
  now: Date = new Date()
): EventStatusChip | null {
  if ((input.role || 'founder') !== 'founder') return null;
  // null means the submission state could not be determined — show nothing
  // rather than a wrong "Not submitted".
  if (input.mySubmission === null) return null;
  if (input.mySubmission) return { label: 'Submitted', tone: 'ready' };

  const countdown = deadlineCountdown(input.submissionDeadline, now);
  if (!countdown) return { label: 'Not submitted', tone: 'muted' };
  if (countdown === 'past due') return { label: 'Not submitted · past due', tone: 'warn' };

  const urgent = countdown === 'due today' || countdown === 'due tomorrow' || /due in [1-7]d/.test(countdown);
  return { label: `Not submitted · ${countdown}`, tone: urgent ? 'warn' : 'muted' };
}

export type RibbonEvent = {
  slug: string;
  name: string;
  submission_deadline?: string | null;
  event_date?: string | null;
  status?: string | null;
  mySubmission?: boolean;
  pitch_event_participants?: Array<{ role?: string | null; status?: string | null }>;
};

export type RibbonInvitation = {
  event: { slug: string; name: string };
  invite_url: string;
};

export type RibbonModel =
  | { kind: 'invitation'; name: string; href: string }
  | { kind: 'event'; name: string; href: string; countdown: string | null; submitted: boolean }
  | null;

/**
 * The single most relevant thing for the home surface: a pending invitation
 * beats everything; otherwise the active founder event with the nearest
 * upcoming deadline (falling back to event date). Null keeps the ribbon off
 * the solo founder's screen entirely.
 */
export function pickRibbon(
  events: RibbonEvent[] | null | undefined,
  invitations: RibbonInvitation[] | null | undefined,
  now: Date = new Date()
): RibbonModel {
  const invitation = invitations?.[0];
  if (invitation?.event?.name && invitation.invite_url) {
    return { kind: 'invitation', name: invitation.event.name, href: invitation.invite_url };
  }

  const candidates = (events || []).filter((event) => {
    const participant = event.pitch_event_participants?.[0];
    return (
      (participant?.status || 'active') === 'active' &&
      (participant?.role || 'founder') === 'founder' &&
      event.status !== 'archived'
    );
  });
  if (!candidates.length) return null;

  const sortKey = (event: RibbonEvent) => {
    const raw = event.submission_deadline || event.event_date;
    const time = raw ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59` : raw).getTime() : NaN;
    if (Number.isNaN(time)) return Number.MAX_SAFE_INTEGER;
    // Past events sink below upcoming ones but stay eligible.
    return time >= now.getTime() ? time : time + Number.MAX_SAFE_INTEGER / 2;
  };
  const best = [...candidates].sort((a, b) => sortKey(a) - sortKey(b))[0];

  return {
    kind: 'event',
    name: best.name,
    href: `/events/${encodeURIComponent(best.slug)}`,
    countdown: deadlineCountdown(best.submission_deadline || best.event_date, now),
    submitted: Boolean(best.mySubmission),
  };
}
