/**
 * Groups a founder's own event takes with the feedback each received, so the
 * event page can answer "what did my cohort and mentors say?" in one place.
 * Pure: the caller supplies pitches already scoped to the viewer by the API.
 */

const REVIEWER_ROLE_LABELS: Record<string, string> = {
  peer_founder: 'Peer',
  coach: 'Coach',
  mentor: 'Mentor',
  judge: 'Judge',
  organizer: 'Organizer',
  experienced_reviewer: 'Experienced reviewer',
  trusted_reviewer: 'Trusted reviewer',
  public_reviewer: 'Reviewer',
};

export function reviewerRoleLabel(role?: string | null) {
  return REVIEWER_ROLE_LABELS[role || ''] || 'Reviewer';
}

export type EventFeedbackEntry = {
  id: string;
  type: 'roast' | 'toast' | string;
  content: string | null;
  roleLabel: string;
  createdAt: string | null;
};

export type EventTakeFeedback = {
  pitchId: string;
  publicId: string | null;
  hook: string;
  takeLabel: string;
  createdAt: string | null;
  isSubmitted: boolean;
  feedback: EventFeedbackEntry[];
};

/**
 * Only the viewer's own takes bound to this event are returned; feedback rows
 * arrive already scoped by the API/RLS, so this never widens visibility.
 */
export function groupEventTakeFeedback(
  pitches: Array<Record<string, any>> | null | undefined,
  input: { eventId?: string | null; viewerId?: string | null; submittedPitchId?: string | null }
): EventTakeFeedback[] {
  if (!pitches?.length || !input.eventId || !input.viewerId) return [];

  return pitches
    .filter((pitch) => pitch.event_id === input.eventId && pitch.user_id === input.viewerId)
    .map((pitch) => {
      const rawFeedback = Array.isArray(pitch.feedback) ? pitch.feedback : [];
      const feedback: EventFeedbackEntry[] = rawFeedback
        .map((entry: any) => ({
          id: String(entry.id),
          type: entry.type || 'toast',
          content: entry.content || null,
          roleLabel: reviewerRoleLabel(entry.reviewer_role),
          createdAt: entry.created_at || null,
        }))
        .sort((a: EventFeedbackEntry, b: EventFeedbackEntry) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );

      const version = pitch.take_version || pitch.version_number;
      return {
        pitchId: String(pitch.id),
        publicId: pitch.public_id || null,
        hook: pitch.hook || 'Untitled take',
        takeLabel: version ? `Take ${version}` : 'Take',
        createdAt: pitch.created_at || null,
        isSubmitted: Boolean(input.submittedPitchId && pitch.id === input.submittedPitchId),
        feedback,
      };
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

export function countEventFeedback(takes: EventTakeFeedback[]) {
  return takes.reduce((total, take) => total + take.feedback.length, 0);
}
