export type EventOutcomeInvitation = {
  email: string | null;
  status: string;
  acceptedUserId?: string | null;
};

export type EventOutcomeParticipant = {
  userId: string;
  name: string | null;
  email: string | null;
  status: string;
  joinedAt: string | null;
};

export type EventOutcomeFeedback = {
  type: string;
  content: string;
  createdAt: string;
};

export type EventOutcomePitch = {
  id: string;
  userId: string;
  status: string | null;
  deletedAt: string | null;
  createdAt: string;
  isBestTake: boolean;
  feedback: EventOutcomeFeedback[];
};

export type EventOutcomeSubmission = {
  userId: string;
  pitchId: string;
  status: string;
  submittedAt: string | null;
};

export type EventOutcomeInput = {
  event: {
    name: string;
    slug: string;
    eventDate: string;
    submissionDeadline: string | null;
  };
  generatedAt: string;
  invitations: EventOutcomeInvitation[];
  participants: EventOutcomeParticipant[];
  pitches: EventOutcomePitch[];
  submissions: EventOutcomeSubmission[];
};

export type EventOutcomeFounder = {
  founderName: string;
  email: string;
  invitationStatus: string;
  membershipStatus: string;
  joinedDate: string | null;
  eligibleTakeCount: number;
  firstTakeCompleted: boolean;
  improvedTakeCompleted: boolean;
  feedbackItemsReceived: number;
  feedbackCovered: boolean;
  minutesToFirstFeedback: number | null;
  bestTakeCompleted: boolean;
  finalSubmissionCompleted: boolean;
  submittedDate: string | null;
  pitchReady: boolean;
  commonImprovementSignals: string[];
};

export type EventOutcomeReport = {
  event: {
    name: string;
    slug: string;
    eventDate: string;
    submissionDeadline: string | null;
    reportingStart: string | null;
    reportingEnd: string;
    generatedAt: string;
  };
  metrics: {
    invited: number;
    joined: number;
    firstTake: number;
    improvedTake: number;
    feedbackCoverage: { count: number; total: number; percent: number | null };
    averageTimeToFirstFeedbackMinutes: number | null;
    medianTimeToFirstFeedbackMinutes: number | null;
    timeToFirstFeedbackSampleSize: number;
    bestTake: number;
    finalSubmission: number;
    pitchReady: number;
  };
  commonImprovementSignals: Array<{
    label: string;
    founderCount: number;
    occurrences: number;
  }>;
  founders: EventOutcomeFounder[];
  definitions: Array<{ label: string; definition: string }>;
  attributionNote: string;
};

const DEFINITIONS = [
  { label: 'Invited', definition: 'Unique founder email invitations that were not revoked.' },
  { label: 'Joined', definition: 'Founders with an active event membership.' },
  { label: 'First Take', definition: 'Joined founders with at least one eligible take in the reporting window.' },
  { label: 'Improved Take', definition: 'Joined founders with at least two eligible takes in the reporting window.' },
  { label: 'Feedback coverage', definition: 'First-Take founders who received feedback on an eligible take.' },
  { label: 'Time to first feedback', definition: 'Time from a founder\'s first eligible take to its first valid feedback item.' },
  { label: 'Best Take', definition: 'Joined founders with an eligible or submitted pitch marked Best Take.' },
  { label: 'Final submission', definition: 'Joined founders with a submitted or locked event submission.' },
  { label: 'Pitch-ready', definition: 'Joined founders whose submitted or latest eligible take received a readiness rating of 4.' },
  { label: 'Improvement signals', definition: 'Structured signals from Roast feedback; private notes are never included.' },
] as const;

const ATTRIBUTION_NOTE = 'Eligible activity uses published takes recorded after a founder joined and before the event cutoff. Because historical pitches are not directly linked to events, these are conservative event-window outcomes rather than causal attribution. The event submission is always included.';

function timestamp(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function normalizedEmail(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

function eventDayEnd(value: string) {
  const time = timestamp(`${value}T23:59:59.999Z`);
  return time ?? 0;
}

function reportCutoff(input: EventOutcomeInput) {
  const generated = timestamp(input.generatedAt) ?? Date.now();
  const deadline = timestamp(input.event.submissionDeadline) ?? 0;
  const configuredEnd = Math.max(eventDayEnd(input.event.eventDate), deadline);
  return Math.min(generated, configuredEnd || generated);
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function cleanSignal(value: unknown) {
  if (typeof value !== 'string') return null;
  const signal = value.trim().replace(/\s+/g, ' ');
  return signal && signal.length <= 80 ? signal : null;
}

/** Parses only report-safe structured fields. Raw content and notes never leave this function. */
export function sanitizeOutcomeFeedback(feedback: EventOutcomeFeedback) {
  let parsed: Record<string, unknown> = {};
  try {
    const value = JSON.parse(feedback.content);
    if (value && typeof value === 'object' && !Array.isArray(value)) parsed = value as Record<string, unknown>;
  } catch {
    // Legacy plain text is a private note, not a structured report signal.
  }

  const rawSignals = Array.isArray(parsed.signals)
    ? parsed.signals
    : typeof parsed.signal === 'string'
      ? [parsed.signal]
      : [];
  const signals = [...new Set(rawSignals.map(cleanSignal).filter((value): value is string => Boolean(value)))];
  const readinessValue = Number(parsed.readiness);
  const readiness = Number.isInteger(readinessValue) && readinessValue >= 1 && readinessValue <= 4
    ? readinessValue
    : null;

  return {
    type: feedback.type === 'roast' ? 'roast' as const : 'toast' as const,
    signals,
    readiness,
    createdAt: feedback.createdAt,
  };
}

function invitationLabel(value?: string | null) {
  if (value === 'accepted') return 'Accepted';
  if (value === 'pending') return 'Pending';
  if (value === 'revoked') return 'Revoked';
  return 'Not tracked';
}

function membershipLabel(value?: string | null) {
  if (value === 'active') return 'Joined';
  if (value === 'removed') return 'Removed';
  if (value === 'invited') return 'Invited';
  return 'Not joined';
}

function submitted(value: EventOutcomeSubmission | undefined, cutoff: number) {
  const submittedAt = timestamp(value?.submittedAt);
  return (value?.status === 'submitted' || value?.status === 'locked')
    && submittedAt !== null
    && submittedAt <= cutoff;
}

function eligibleFeedback(pitch: EventOutcomePitch | undefined, cutoff: number) {
  if (!pitch) return [];
  const pitchCreatedAt = timestamp(pitch.createdAt);
  if (pitchCreatedAt === null) return [];
  return pitch.feedback.filter((feedback) => {
    const createdAt = timestamp(feedback.createdAt);
    return createdAt !== null && createdAt >= pitchCreatedAt && createdAt <= cutoff;
  });
}

export function buildEventOutcomeReport(input: EventOutcomeInput): EventOutcomeReport {
  const cutoff = reportCutoff(input);
  const pitchById = new Map(input.pitches.map((pitch) => [pitch.id, pitch]));
  const submissionByUser = new Map(input.submissions.map((submission) => [submission.userId, submission]));
  const invitationByUser = new Map(
    input.invitations
      .filter((invite) => invite.acceptedUserId)
      .map((invite) => [invite.acceptedUserId as string, invite])
  );
  const invitationByEmail = new Map<string, EventOutcomeInvitation>();

  input.invitations.forEach((invite) => {
    const email = normalizedEmail(invite.email);
    if (!email || invite.status === 'revoked') return;
    const current = invitationByEmail.get(email);
    if (!current || (current.status === 'pending' && invite.status === 'accepted')) {
      invitationByEmail.set(email, invite);
    }
  });

  const participantRows = input.participants.map((participant) => {
    const joinTime = timestamp(participant.joinedAt);
    const rawSubmission = submissionByUser.get(participant.userId);
    const submission = submitted(rawSubmission, cutoff) ? rawSubmission : undefined;
    const eligiblePitches = input.pitches
      .filter((pitch) => {
        if (pitch.userId !== participant.userId || pitch.deletedAt) return false;
        if (submission?.pitchId === pitch.id) return true;
        const created = timestamp(pitch.createdAt);
        return participant.status === 'active'
          && pitch.status === 'published'
          && joinTime !== null
          && created !== null
          && created >= joinTime
          && created <= cutoff;
      })
      .sort((a, b) => (timestamp(a.createdAt) ?? 0) - (timestamp(b.createdAt) ?? 0));
    const firstPitch = eligiblePitches[0];
    const targetPitch = (submission && pitchById.get(submission.pitchId)) || eligiblePitches.at(-1);
    const feedbackItems = eligiblePitches.flatMap((pitch) => eligibleFeedback(pitch, cutoff).map(sanitizeOutcomeFeedback));
    const firstFeedbackMinutes = firstPitch
      ? eligibleFeedback(firstPitch, cutoff)
          .map((feedback) => timestamp(feedback.createdAt))
          .filter((time): time is number => time !== null)
          .sort((a, b) => a - b)
          .at(0)
      : undefined;
    const firstPitchTime = firstPitch ? timestamp(firstPitch.createdAt) : null;
    const minutesToFirstFeedback = firstPitchTime !== null && typeof firstFeedbackMinutes === 'number'
      ? round((firstFeedbackMinutes - firstPitchTime) / 60000)
      : null;
    const signalCounts = new Map<string, { label: string; count: number }>();
    feedbackItems.filter((feedback) => feedback.type === 'roast').forEach((feedback) => {
      feedback.signals.forEach((signal) => {
        const key = signal.toLocaleLowerCase();
        const current = signalCounts.get(key);
        signalCounts.set(key, { label: current?.label || signal, count: (current?.count || 0) + 1 });
      });
    });
    const targetFeedback = eligibleFeedback(targetPitch, cutoff).map(sanitizeOutcomeFeedback);
    const email = normalizedEmail(participant.email);
    const invitation = invitationByUser.get(participant.userId) || invitationByEmail.get(email);

    return {
      userId: participant.userId,
      founderName: participant.name?.trim() || email || 'Founder',
      email,
      invitationStatus: invitationLabel(invitation?.status),
      membershipStatus: membershipLabel(participant.status),
      joinedDate: participant.joinedAt,
      eligibleTakeCount: eligiblePitches.length,
      firstTakeCompleted: eligiblePitches.length >= 1,
      improvedTakeCompleted: eligiblePitches.length >= 2,
      feedbackItemsReceived: feedbackItems.length,
      feedbackCovered: feedbackItems.length > 0,
      minutesToFirstFeedback,
      bestTakeCompleted: eligiblePitches.some((pitch) => pitch.isBestTake),
      finalSubmissionCompleted: Boolean(submission),
      submittedDate: submission?.submittedAt || null,
      pitchReady: targetFeedback.some((feedback) => feedback.readiness === 4),
      commonImprovementSignals: [...signalCounts.values()]
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .map((signal) => signal.label),
      signalCounts,
    };
  });

  const participantEmails = new Set(participantRows.map((row) => row.email).filter(Boolean));
  const pendingRows = [...invitationByEmail.entries()]
    .filter(([email]) => !participantEmails.has(email))
    .map(([email, invite]) => ({
      userId: null,
      founderName: email,
      email,
      invitationStatus: invitationLabel(invite.status),
      membershipStatus: 'Not joined',
      joinedDate: null,
      eligibleTakeCount: 0,
      firstTakeCompleted: false,
      improvedTakeCompleted: false,
      feedbackItemsReceived: 0,
      feedbackCovered: false,
      minutesToFirstFeedback: null,
      bestTakeCompleted: false,
      finalSubmissionCompleted: false,
      submittedDate: null,
      pitchReady: false,
      commonImprovementSignals: [],
      signalCounts: new Map<string, { label: string; count: number }>(),
    }));
  const allRows = [...participantRows, ...pendingRows]
    .sort((a, b) => a.founderName.localeCompare(b.founderName));
  const activeRows = participantRows.filter((row) => row.membershipStatus === 'Joined');
  const firstTakeRows = activeRows.filter((row) => row.firstTakeCompleted);
  const timingValues = activeRows
    .map((row) => row.minutesToFirstFeedback)
    .filter((value): value is number => value !== null);
  const signalTotals = new Map<string, { label: string; founderIds: Set<string>; occurrences: number }>();

  activeRows.forEach((row) => {
    row.signalCounts.forEach((signal, key) => {
      const current = signalTotals.get(key) || { label: signal.label, founderIds: new Set<string>(), occurrences: 0 };
      current.founderIds.add(row.userId);
      current.occurrences += signal.count;
      signalTotals.set(key, current);
    });
  });

  const reportingStarts = activeRows
    .map((row) => timestamp(row.joinedDate))
    .filter((value): value is number => value !== null);

  return {
    event: {
      name: input.event.name,
      slug: input.event.slug,
      eventDate: input.event.eventDate,
      submissionDeadline: input.event.submissionDeadline,
      reportingStart: reportingStarts.length ? new Date(Math.min(...reportingStarts)).toISOString() : null,
      reportingEnd: new Date(cutoff).toISOString(),
      generatedAt: input.generatedAt,
    },
    metrics: {
      invited: invitationByEmail.size,
      joined: activeRows.length,
      firstTake: firstTakeRows.length,
      improvedTake: activeRows.filter((row) => row.improvedTakeCompleted).length,
      feedbackCoverage: {
        count: firstTakeRows.filter((row) => row.feedbackCovered).length,
        total: firstTakeRows.length,
        percent: firstTakeRows.length
          ? Math.round((firstTakeRows.filter((row) => row.feedbackCovered).length / firstTakeRows.length) * 100)
          : null,
      },
      averageTimeToFirstFeedbackMinutes: timingValues.length
        ? round(timingValues.reduce((sum, value) => sum + value, 0) / timingValues.length)
        : null,
      medianTimeToFirstFeedbackMinutes: timingValues.length ? round(median(timingValues) as number) : null,
      timeToFirstFeedbackSampleSize: timingValues.length,
      bestTake: activeRows.filter((row) => row.bestTakeCompleted).length,
      finalSubmission: activeRows.filter((row) => row.finalSubmissionCompleted).length,
      pitchReady: activeRows.filter((row) => row.pitchReady).length,
    },
    commonImprovementSignals: [...signalTotals.values()]
      .map((signal) => ({
        label: signal.label,
        founderCount: signal.founderIds.size,
        occurrences: signal.occurrences,
      }))
      .sort((a, b) => b.founderCount - a.founderCount || b.occurrences - a.occurrences || a.label.localeCompare(b.label))
      .slice(0, 8),
    founders: allRows.map(({ userId: _userId, signalCounts: _signalCounts, ...row }) => row),
    definitions: DEFINITIONS.map((definition) => ({ ...definition })),
    attributionNote: ATTRIBUTION_NOTE,
  };
}

const CSV_COLUMNS: Array<{ heading: string; value: (founder: EventOutcomeFounder) => string | number | boolean | null }> = [
  { heading: 'Founder name', value: (founder) => founder.founderName },
  { heading: 'Email', value: (founder) => founder.email },
  { heading: 'Invitation status', value: (founder) => founder.invitationStatus },
  { heading: 'Membership status', value: (founder) => founder.membershipStatus },
  { heading: 'Joined date', value: (founder) => founder.joinedDate },
  { heading: 'Eligible take count', value: (founder) => founder.eligibleTakeCount },
  { heading: 'First Take completed', value: (founder) => founder.firstTakeCompleted },
  { heading: 'Improved Take completed', value: (founder) => founder.improvedTakeCompleted },
  { heading: 'Feedback items received', value: (founder) => founder.feedbackItemsReceived },
  { heading: 'Feedback covered', value: (founder) => founder.feedbackCovered },
  { heading: 'Minutes to first feedback', value: (founder) => founder.minutesToFirstFeedback },
  { heading: 'Best Take completed', value: (founder) => founder.bestTakeCompleted },
  { heading: 'Final submission completed', value: (founder) => founder.finalSubmissionCompleted },
  { heading: 'Submitted date', value: (founder) => founder.submittedDate },
  { heading: 'Pitch-ready', value: (founder) => founder.pitchReady },
  { heading: 'Common improvement signals', value: (founder) => founder.commonImprovementSignals.join(' | ') },
];

function safeCsvCell(value: string | number | boolean | null) {
  let text = value === null ? '' : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  if (/^[\uFEFF\s]*[=+\-@]/u.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function eventOutcomeCsv(report: EventOutcomeReport) {
  const rows = [
    CSV_COLUMNS.map((column) => safeCsvCell(column.heading)).join(','),
    ...report.founders.map((founder) => CSV_COLUMNS.map((column) => safeCsvCell(column.value(founder))).join(',')),
  ];
  return `\uFEFF${rows.join('\r\n')}\r\n`;
}
