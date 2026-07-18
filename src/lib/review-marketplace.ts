import type {
  EventReviewCoverage,
  FeedbackQualityAction,
  FeedbackQualityRating,
  LegacyFeedback,
  ReviewAssignmentStatus,
  ReviewerRole,
  ReviewQueueSummary,
} from '@/types';

const ROLE_LABELS: Record<ReviewerRole, string> = {
  peer_founder: 'Peer founder',
  coach: 'Coach',
  mentor: 'Mentor',
  judge: 'Judge',
  organizer: 'Organizer',
  experienced_reviewer: 'Experienced reviewer',
  public_reviewer: 'Public reviewer',
};

const ASSIGNMENT_STATES = new Set<ReviewAssignmentStatus>(['pending', 'started', 'submitted', 'skipped', 'expired']);
const QUALITY_RATINGS = new Set<FeedbackQualityRating>(['useful', 'generic', 'not_helpful']);

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

function finiteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeReviewerRole(value?: string | null): ReviewerRole | null {
  const normalized = (value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (normalized === 'founder' || normalized === 'peer') return 'peer_founder';
  if (normalized === 'admin') return 'organizer';
  if (normalized === 'reviewer' || normalized === 'experienced') return 'experienced_reviewer';
  return normalized in ROLE_LABELS ? normalized as ReviewerRole : null;
}

export function reviewerRoleLabel(value?: string | null) {
  const role = normalizeReviewerRole(value);
  return role ? ROLE_LABELS[role] : 'Reviewer';
}

export function feedbackReviewerDisplay(feedback: Pick<LegacyFeedback, 'authorName' | 'authorRole' | 'reviewerRole' | 'displayRoleOnly'>) {
  const role = reviewerRoleLabel(feedback.reviewerRole || feedback.authorRole);
  return {
    name: feedback.displayRoleOnly ? role : feedback.authorName || role,
    role,
  };
}

export function normalizeLegacyFeedback(itemValue: unknown): LegacyFeedback {
  const item = objectValue(itemValue);
  let content: Record<string, any> = {};
  try {
    content = item.content ? objectValue(JSON.parse(item.content)) : {};
  } catch {
    content = { notes: item.content || '' };
  }

  const role = item.reviewer_role || item.reviewerRole || item.author_role || item.authorRole || item.role;
  const displayRoleOnly = Boolean(item.display_role_only ?? item.displayRoleOnly ?? item.anonymous_to_crowd ?? item.anonymousToCrowd);
  const quality = objectValue(item.quality_vote || item.qualityVote || item.quality);
  const rawRating = quality.rating || item.quality_rating || item.qualityRating;
  const qualityRating = QUALITY_RATINGS.has(rawRating) ? rawRating as FeedbackQualityRating : null;
  const rawAction = objectValue(quality.action || item.quality_action || item.qualityAction);
  const actionHref = rawAction.href || rawAction.url;
  const qualityAction: FeedbackQualityAction | null = typeof actionHref === 'string' && actionHref.startsWith('/') && !actionHref.startsWith('//')
    ? { href: actionHref, method: ['POST', 'PUT', 'PATCH'].includes(rawAction.method) ? rawAction.method : 'POST' }
    : null;

  return {
    id: String(item.id || ''),
    authorName: item.author_name || item.authorName || item.author?.full_name || 'Reviewer',
    authorRole: reviewerRoleLabel(role),
    reviewerRole: normalizeReviewerRole(role) || role || null,
    displayRoleOnly,
    type: item.type === 'roast' ? 'roast' : 'toast',
    signal: content.signal,
    signals: content.signals || (content.signal ? [content.signal] : undefined),
    readiness: content.readiness,
    scores: content.scores || { clarity: 5, solution: 5, market: 5, presentation: 5 },
    notes: content.notes || '',
    createdAt: item.created_at || item.createdAt || new Date(0).toISOString(),
    canRateQuality: Boolean(quality.can_vote ?? quality.canVote ?? item.can_rate_quality ?? item.canRateQuality) && Boolean(qualityAction),
    qualityRating,
    qualityAction,
  };
}

export function normalizeReviewQueue(payloadValue: unknown): ReviewQueueSummary | null {
  const payload = objectValue(payloadValue);
  const queue = objectValue(payload.reviewQueue || payload.review_queue || payload.queue || payload);
  const rawItems = Array.isArray(queue.items) ? queue.items : Array.isArray(queue.assignments) ? queue.assignments : [];
  const items = rawItems.flatMap((value) => {
    const item = objectValue(value);
    const pitch = objectValue(item.pitch);
    const publicPitchId = item.publicPitchId || item.public_pitch_id || pitch.publicId || pitch.public_id || null;
    const pitchId = item.pitchId || item.pitch_id || pitch.id || publicPitchId;
    if (!item.id || !pitchId || !publicPitchId) return [];
    const rawStatus = item.status;
    const status = ASSIGNMENT_STATES.has(rawStatus) ? rawStatus as ReviewAssignmentStatus : 'pending';
    return [{
      id: String(item.id),
      pitchId: String(pitchId),
      publicPitchId,
      startupName: item.startupName || item.startup_name || pitch.startupName || pitch.startup_name || pitch.company_name || 'Practice pitch',
      hook: item.hook || pitch.hook || 'Share your signal',
      thumbnailUrl: item.thumbnailUrl || item.thumbnail_url || pitch.thumbnailUrl || pitch.thumbnail_url || null,
      eventName: item.eventName || item.event_name || item.event?.name || null,
      dueAt: item.dueAt || item.due_at || null,
      status,
    }];
  });

  if (!items.length) return null;
  const creditValue = objectValue(payload.reviewCredits || payload.review_credits || queue.credits || payload.credits);
  const hasCredits = Object.keys(creditValue).length > 0;
  const reviewsPerCredit = Math.max(1, finiteNumber(creditValue.reviewsPerCredit || creditValue.reviews_per_credit, 2));
  const progress = Math.max(0, finiteNumber(creditValue.progress || creditValue.useful_reviews_toward_next));

  return {
    items,
    pendingCount: finiteNumber(queue.pendingCount || queue.pending_count, items.filter((item) => item.status === 'pending' || item.status === 'started').length),
    credits: hasCredits ? {
      available: finiteNumber(creditValue.available || creditValue.balance),
      pending: finiteNumber(creditValue.pending ?? creditValue.pendingBalance ?? creditValue.pending_balance),
      earned: finiteNumber(creditValue.earned ?? creditValue.earnedCount ?? creditValue.earned_count),
      discounted: finiteNumber(creditValue.discounted),
      reviewsPerCredit,
      progress: Math.min(reviewsPerCredit, progress),
      exempt: Boolean(creditValue.exempt || creditValue.is_exempt),
    } : null,
  };
}

export function normalizeEventReviewCoverage(payloadValue: unknown): EventReviewCoverage | null {
  const payload = objectValue(payloadValue);
  const coverage = objectValue(payload.reviewCoverage || payload.review_coverage || payload.metrics?.reviewCoverage || payload.metrics?.review_coverage);
  if (!Object.keys(coverage).length) return null;
  const optionalNumber = (value: unknown) => value === null || typeof value === 'undefined' ? null : finiteNumber(value);
  return {
    pitchesSubmitted: finiteNumber(coverage.pitchesSubmitted || coverage.pitches_submitted),
    reviewsAssigned: finiteNumber(coverage.reviewsAssigned || coverage.reviews_assigned),
    reviewsCompleted: finiteNumber(coverage.reviewsCompleted || coverage.reviews_completed),
    usefulReviews: optionalNumber(coverage.usefulReviews ?? coverage.useful_reviews),
    pitchesWithFeedback: finiteNumber(coverage.pitchesWithFeedback || coverage.pitches_with_feedback),
    pitchesWithoutFeedback: finiteNumber(coverage.pitchesWithoutFeedback || coverage.pitches_without_feedback),
    foundersWithoutUsefulFeedback: optionalNumber(coverage.foundersWithoutUsefulFeedback ?? coverage.founders_without_useful_feedback),
    completionRate: optionalNumber(coverage.completionRate ?? coverage.completion_rate),
    averageTimeToFirstReviewMinutes: optionalNumber(coverage.averageTimeToFirstReviewMinutes ?? coverage.average_time_to_first_review_minutes),
  };
}
