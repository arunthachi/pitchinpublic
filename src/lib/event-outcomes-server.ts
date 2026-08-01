import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { createRequestSupabase, createServiceSupabase } from '@/lib/admin';
import {
  buildEventOutcomeReport,
  type EventOutcomeFeedback,
  type EventOutcomeInput,
  type EventOutcomePitch,
  type EventOutcomeReport,
} from '@/lib/event-outcomes';

const MANAGER_ROLES = new Set(['organizer', 'admin']);
const QUERY_BATCH_SIZE = 100;

type EventRow = {
  id: string;
  organizer_id: string;
  name: string;
  slug: string;
  event_date: string;
  submission_deadline: string | null;
};

type ParticipantAccess = { role: string; status: string } | null;

export type OutcomeAccess =
  | { ok: true; userId: string; event: EventRow }
  | { ok: false; status: number; error: string };

export class EventOutcomeLoadError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
    this.name = 'EventOutcomeLoadError';
  }
}

export function isOutcomeReportManager(eventOwnerId: string, userId: string, participant: ParticipantAccess) {
  return eventOwnerId === userId
    || Boolean(participant?.status === 'active' && MANAGER_ROLES.has(participant.role));
}

export async function authorizeEventOutcomeReport(request: NextRequest, slug: string): Promise<OutcomeAccess> {
  const requestSupabase = createRequestSupabase(request);
  if (!requestSupabase) {
    return { ok: false, status: 503, error: 'Event outcome reporting is not configured in this environment.' };
  }

  const { data: { user }, error: authError } = await requestSupabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }

  const { data: event, error: eventError } = await requestSupabase
    .from('pitch_events')
    .select('id,organizer_id,name,slug,event_date,submission_deadline')
    .eq('slug', slug)
    .maybeSingle();

  if (eventError || !event) {
    return { ok: false, status: 404, error: 'Event outcome report not found.' };
  }

  let participant: ParticipantAccess = null;
  if (event.organizer_id !== user.id) {
    const { data, error } = await requestSupabase
      .from('pitch_event_participants')
      .select('role,status')
      .eq('event_id', event.id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      return { ok: false, status: 500, error: 'Could not verify event report access.' };
    }
    participant = data;
  }

  if (!isOutcomeReportManager(event.organizer_id, user.id, participant)) {
    return { ok: false, status: 403, error: 'Only event organizers and admins can view outcome reports.' };
  }

  return { ok: true, userId: user.id, event: event as EventRow };
}

type LoaderDependencies = {
  authorize?: (request: NextRequest, slug: string) => Promise<OutcomeAccess>;
  createServiceClient?: () => SupabaseClient | null;
  now?: () => Date;
};

function batches<T>(values: T[], size = QUERY_BATCH_SIZE) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function validTimestamp(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function cutoffForEvent(event: EventRow, generatedAt: string) {
  const eventEnd = validTimestamp(`${event.event_date}T23:59:59.999Z`) || 0;
  const deadline = validTimestamp(event.submission_deadline) || 0;
  return new Date(Math.min(validTimestamp(generatedAt) || Date.now(), Math.max(eventEnd, deadline))).toISOString();
}

function profileValue(value: unknown): { full_name?: string | null; email?: string | null } {
  if (Array.isArray(value)) return profileValue(value[0]);
  return value && typeof value === 'object' ? value as { full_name?: string | null; email?: string | null } : {};
}

async function loadOutcomeSources(client: SupabaseClient, event: EventRow, generatedAt: string): Promise<EventOutcomeInput> {
  const cutoff = cutoffForEvent(event, generatedAt);
  const [participantsResult, invitationsResult, submissionsResult] = await Promise.all([
    client
      .from('pitch_event_participants')
      .select('user_id,status,joined_at,profile:user_id(full_name,email)')
      .eq('event_id', event.id)
      .eq('role', 'founder')
      .order('joined_at', { ascending: true }),
    client
      .from('pitch_event_invitations')
      .select('email,status,accepted_by')
      .eq('event_id', event.id)
      .eq('role', 'founder'),
    client
      .from('pitch_event_submissions')
      .select('user_id,pitch_id,status,submitted_at')
      .eq('event_id', event.id)
      .lte('submitted_at', cutoff),
  ]);

  if (participantsResult.error || invitationsResult.error || submissionsResult.error) {
    throw new EventOutcomeLoadError('Could not load the event roster and submissions.');
  }

  const participantRows = participantsResult.data || [];
  const founderIds = participantRows.map((row) => String(row.user_id));
  const submissionRows = submissionsResult.data || [];
  const submissionPitchIds = [...new Set(submissionRows.map((row) => String(row.pitch_id)).filter(Boolean))];
  const joinTimes = participantRows
    .map((row) => validTimestamp(row.joined_at))
    .filter((value): value is number => value !== null);
  const earliestJoin = joinTimes.length ? new Date(Math.min(...joinTimes)).toISOString() : null;
  const pitchRows: Array<Record<string, unknown>> = [];

  for (const founderBatch of batches(founderIds)) {
    if (!founderBatch.length || !earliestJoin) continue;
    const result = await client
      .from('pitches')
      .select('id,user_id,status,deleted_at,created_at,is_best_take')
      .in('user_id', founderBatch)
      .eq('status', 'published')
      .is('deleted_at', null)
      .gte('created_at', earliestJoin)
      .lte('created_at', cutoff);
    if (result.error) throw new EventOutcomeLoadError('Could not load eligible event takes.');
    pitchRows.push(...(result.data || []));
  }

  for (const pitchBatch of batches(submissionPitchIds)) {
    if (!pitchBatch.length) continue;
    const result = await client
      .from('pitches')
      .select('id,user_id,status,deleted_at,created_at,is_best_take')
      .in('id', pitchBatch);
    if (result.error) throw new EventOutcomeLoadError('Could not load submitted event takes.');
    pitchRows.push(...(result.data || []));
  }

  const uniquePitchRows = [...new Map(pitchRows.map((row) => [String(row.id), row])).values()];
  const pitchIds = uniquePitchRows.map((row) => String(row.id));
  const feedbackByPitch = new Map<string, EventOutcomeFeedback[]>();

  for (const pitchBatch of batches(pitchIds)) {
    if (!pitchBatch.length) continue;
    const result = await client
      .from('feedback')
      .select('pitch_id,type,content,created_at')
      .in('pitch_id', pitchBatch)
      .lte('created_at', cutoff)
      .order('created_at', { ascending: true });
    if (result.error) throw new EventOutcomeLoadError('Could not load event feedback.');
    (result.data || []).forEach((row) => {
      const pitchId = String(row.pitch_id);
      const values = feedbackByPitch.get(pitchId) || [];
      values.push({
        type: String(row.type || ''),
        content: typeof row.content === 'string' ? row.content : '',
        createdAt: String(row.created_at || ''),
      });
      feedbackByPitch.set(pitchId, values);
    });
  }

  const pitches: EventOutcomePitch[] = uniquePitchRows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    status: typeof row.status === 'string' ? row.status : null,
    deletedAt: typeof row.deleted_at === 'string' ? row.deleted_at : null,
    createdAt: String(row.created_at || ''),
    isBestTake: Boolean(row.is_best_take),
    feedback: feedbackByPitch.get(String(row.id)) || [],
  }));

  return {
    event: {
      name: event.name,
      slug: event.slug,
      eventDate: event.event_date,
      submissionDeadline: event.submission_deadline,
    },
    generatedAt,
    invitations: (invitationsResult.data || []).map((row) => ({
      email: typeof row.email === 'string' ? row.email : null,
      status: String(row.status || ''),
      acceptedUserId: typeof row.accepted_by === 'string' ? row.accepted_by : null,
    })),
    participants: participantRows.map((row) => {
      const profile = profileValue(row.profile);
      return {
        userId: String(row.user_id),
        name: typeof profile.full_name === 'string' ? profile.full_name : null,
        email: typeof profile.email === 'string' ? profile.email : null,
        status: String(row.status || ''),
        joinedAt: typeof row.joined_at === 'string' ? row.joined_at : null,
      };
    }),
    pitches,
    submissions: submissionRows.map((row) => ({
      userId: String(row.user_id),
      pitchId: String(row.pitch_id),
      status: String(row.status || ''),
      submittedAt: typeof row.submitted_at === 'string' ? row.submitted_at : null,
    })),
  };
}

export async function loadEventOutcomeReport(
  request: NextRequest,
  slug: string,
  dependencies: LoaderDependencies = {}
): Promise<{ ok: true; report: EventOutcomeReport } | { ok: false; status: number; error: string }> {
  const authorize = dependencies.authorize || authorizeEventOutcomeReport;
  const access = await authorize(request, slug);
  if (!access.ok) return access;

  const createServiceClient = dependencies.createServiceClient || createServiceSupabase;
  const serviceSupabase = createServiceClient();
  if (!serviceSupabase) {
    return { ok: false, status: 503, error: 'Event outcome reporting is not configured in this environment.' };
  }

  try {
    const generatedAt = (dependencies.now?.() || new Date()).toISOString();
    const input = await loadOutcomeSources(serviceSupabase, access.event, generatedAt);
    return { ok: true, report: buildEventOutcomeReport(input) };
  } catch (error) {
    if (error instanceof EventOutcomeLoadError) {
      console.error('Event outcome report load failed:', error.message);
      return { ok: false, status: error.status, error: 'Could not load the complete event outcome report.' };
    }
    console.error('Event outcome report load failed:', error);
    return { ok: false, status: 500, error: 'Could not load the complete event outcome report.' };
  }
}
