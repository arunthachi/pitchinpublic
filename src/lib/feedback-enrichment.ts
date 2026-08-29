export type FeedbackAvailabilityState = 'available' | 'unavailable';

export type FeedbackQueryResult<T> =
  | {
      feedbackState: 'available';
      feedbackByPitch: ReadonlyMap<string, T[]>;
    }
  | {
      feedbackState: 'unavailable';
      error: unknown;
    };

type FeedbackRow = { pitch_id?: unknown };

/**
 * Converts a Supabase feedback response into an explicit availability result.
 * A failed enrichment never becomes an empty array, because that would make an
 * outage indistinguishable from a pitch that genuinely has no feedback.
 */
export function resolveFeedbackQuery<T extends FeedbackRow>(result: {
  data: T[] | null;
  error: unknown;
}): FeedbackQueryResult<T> {
  if (result.error) {
    return { feedbackState: 'unavailable', error: result.error };
  }

  if (!Array.isArray(result.data)) {
    return {
      feedbackState: 'unavailable',
      error: new Error('Feedback query returned no data without an error.'),
    };
  }

  const feedbackByPitch = new Map<string, T[]>();
  for (const row of result.data) {
    if (typeof row.pitch_id !== 'string' || !row.pitch_id) continue;
    const current = feedbackByPitch.get(row.pitch_id) || [];
    current.push(row);
    feedbackByPitch.set(row.pitch_id, current);
  }

  return { feedbackState: 'available', feedbackByPitch };
}

export function attachFeedbackAvailability<T extends Record<string, any>, F, R = F>(
  pitch: T,
  enrichment: FeedbackQueryResult<F & FeedbackRow>,
  transform: (feedback: F & FeedbackRow) => R = (feedback) => feedback as unknown as R,
): (Omit<T, 'feedback'> & { feedbackState: 'unavailable' })
  | (Omit<T, 'feedback'> & { feedbackState: 'available'; feedback: R[] }) {
  const { feedback: _discardedEmbeddedFeedback, ...basePitch } = pitch;

  if (enrichment.feedbackState === 'unavailable') {
    return { ...basePitch, feedbackState: 'unavailable' };
  }

  const feedback = (enrichment.feedbackByPitch.get(String(pitch.id)) || []).map(transform);
  return { ...basePitch, feedbackState: 'available', feedback };
}

export function availableFeedback<T extends FeedbackRow = FeedbackRow>(): FeedbackQueryResult<T> {
  return { feedbackState: 'available', feedbackByPitch: new Map() };
}
