import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { createServiceSupabase, normalizeEmail } from '@/lib/admin';

const createEventSchema = z.object({
  name: z.string().min(3).max(120).trim(),
  description: z.string().max(1000).optional().or(z.literal('')),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  submissionDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  pitchLengthSeconds: z.coerce.number().min(30).max(360).optional(),
  pitchLengthMinutes: z.coerce.number().min(0.5).max(6).optional(),
  focus: z.string().min(2).max(160).optional(),
  focuses: z.array(z.string().trim().min(2).max(40)).optional(),
  visibility: z.enum(['private', 'unlisted', 'public']).default('unlisted'),
  accessCode: z.string().min(4).max(32).optional().or(z.literal('')),
  reviewTarget: z.coerce.number().int().min(1).max(10).default(3),
  pitchHourStartsAt: z.string().datetime().optional().or(z.literal('')),
  pitchHourEndsAt: z.string().datetime().optional().or(z.literal('')),
}).superRefine((value, ctx) => {
  if (value.submissionDeadline && value.submissionDeadline > value.eventDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['submissionDeadline'],
      message: 'Submission deadline must be on or before pitch day.',
    });
  }
  if (Boolean(value.pitchHourStartsAt) !== Boolean(value.pitchHourEndsAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pitchHourStartsAt'], message: 'Choose both a start and end for Pitch Hour.' });
  }
  if (value.pitchHourStartsAt && value.pitchHourEndsAt && new Date(value.pitchHourEndsAt) <= new Date(value.pitchHourStartsAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pitchHourEndsAt'], message: 'Pitch Hour must end after it starts.' });
  }
});

const idempotencyKeySchema = z.string().uuid();

export function parseEventIdempotencyKey(value: string | null) {
  if (!value) return { key: null, valid: true } as const;
  const parsed = idempotencyKeySchema.safeParse(value.trim());
  return parsed.success
    ? ({ key: parsed.data, valid: true } as const)
    : ({ key: null, valid: false } as const);
}

export function hashEventCreationPayload(payload: unknown) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function eventResponse(event: Record<string, unknown>) {
  const safeEvent = { ...event };
  delete safeEvent.creation_key;
  delete safeEvent.creation_payload_hash;
  return safeEvent;
}

function createSupabase(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  if (error && typeof error === 'object') {
    const maybeError = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [maybeError.message, maybeError.details, maybeError.hint]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0);

    if (parts.length > 0) return parts.join(' ');
    if (typeof maybeError.code === 'string') return `Database error ${maybeError.code}`;
  }

  return 'Failed to create event';
}

async function canCreatePitchEvents(supabase: ReturnType<typeof createSupabase>, userId: string) {
  const { data, error } = await supabase
    .from('profile_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['organizer', 'admin'])
    .limit(1);

  if (error) {
    console.error('Error checking organizer role:', error);
    return false;
  }

  return Boolean(data?.length);
}

export type PendingEventInvitationRow = {
  id: string;
  status?: string | null;
  email?: string | null;
  dedupe_email?: string | null;
  expires_at?: string | null;
};

/**
 * Security boundary: only rows whose normalized email matches the signed-in
 * user's normalized email, are still pending, and are not expired make it
 * into the response. Never widen this to return another founder's invite.
 */
export function filterPendingInvitationsForEmail<T extends PendingEventInvitationRow>(
  rows: T[],
  email: string | null | undefined,
  now: Date = new Date()
): T[] {
  const normalized = normalizeEmail(email);
  if (!normalized) return [];

  return rows.filter((row) => {
    if (row.status !== 'pending') return false;
    if (normalizeEmail(row.dedupe_email ?? row.email) !== normalized) return false;
    if (!row.expires_at) return true;
    const expiresAt = new Date(row.expires_at).getTime();
    return !(Number.isFinite(expiresAt) && expiresAt <= now.getTime());
  });
}

export function buildOrganizerParticipantUpsert(eventId: string, userId: string) {
  return {
    values: {
      event_id: eventId,
      user_id: userId,
      role: 'organizer',
      status: 'active',
    },
    options: { onConflict: 'event_id,user_id' },
  } as const;
}

async function ensureOrganizerParticipant(eventId: string, userId: string) {
  const adminSupabase = createServiceSupabase();
  if (!adminSupabase) {
    throw new Error('Event participant setup is not configured in this environment.');
  }

  const participant = buildOrganizerParticipantUpsert(eventId, userId);
  const { error } = await adminSupabase
    .from('pitch_event_participants')
    .upsert(participant.values, participant.options);

  if (error) throw error;
}

export async function POST(request: NextRequest) {
  const supabase = createSupabase(request);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const isOrganizer = await canCreatePitchEvents(supabase, user.id);

  if (!isOrganizer) {
    return NextResponse.json(
      {
        success: false,
        error: 'Organizer access is required to create events. Founders can join events from an invite link.',
      },
      { status: 403 }
    );
  }

  const body = await request.json();
  const validation = createEventSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid event data', issues: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = validation.data;
  const idempotency = parseEventIdempotencyKey(request.headers.get('Idempotency-Key'));
  if (!idempotency.valid) {
    return NextResponse.json(
      { success: false, error: 'Idempotency-Key must be a valid UUID.' },
      { status: 400 }
    );
  }
  const creationPayloadHash = idempotency.key ? hashEventCreationPayload(data) : null;
  const baseSlug = slugify(data.name) || 'pitch-sprint';
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
  const selectedFocuses = data.focuses?.map((item) => item.trim()).filter(Boolean) || [];
  const focusSummary = selectedFocuses.length ? selectedFocuses.join(' · ') : data.focus?.trim() || 'Clarity';
  const pitchLengthSeconds = data.pitchLengthSeconds ?? Math.round((data.pitchLengthMinutes ?? 1) * 60);

  try {
    if (idempotency.key) {
      const { data: existingEvent, error: replayLookupError } = await supabase
        .from('pitch_events')
        .select('*')
        .eq('organizer_id', user.id)
        .eq('creation_key', idempotency.key)
        .maybeSingle();

      if (replayLookupError) throw replayLookupError;
      if (existingEvent) {
        if (existingEvent.creation_payload_hash !== creationPayloadHash) {
          return NextResponse.json(
            { success: false, error: 'Idempotency-Key was already used with different event data.' },
            { status: 409 }
          );
        }
        await ensureOrganizerParticipant(existingEvent.id, user.id);
        return NextResponse.json({ success: true, replayed: true, event: eventResponse(existingEvent) });
      }
    }

    const { data: event, error } = await supabase
      .from('pitch_events')
      .insert({
        organizer_id: user.id,
        name: data.name,
        slug,
        description: data.description || null,
        event_date: data.eventDate,
        submission_deadline: data.submissionDeadline || null,
        pitch_length_seconds: pitchLengthSeconds,
        focus: focusSummary,
        visibility: data.visibility,
        access_code: data.accessCode || null,
        review_target: data.reviewTarget,
        pitch_hour_starts_at: data.pitchHourStartsAt || null,
        pitch_hour_ends_at: data.pitchHourEndsAt || null,
        status: 'active',
        creation_key: idempotency.key,
        creation_payload_hash: creationPayloadHash,
      })
      .select('*')
      .single();

    if (error?.code === '23505' && idempotency.key) {
      const { data: racedEvent, error: racedLookupError } = await supabase
        .from('pitch_events')
        .select('*')
        .eq('organizer_id', user.id)
        .eq('creation_key', idempotency.key)
        .maybeSingle();

      if (racedLookupError) throw racedLookupError;
      if (racedEvent) {
        if (racedEvent.creation_payload_hash !== creationPayloadHash) {
          return NextResponse.json(
            { success: false, error: 'Idempotency-Key was already used with different event data.' },
            { status: 409 }
          );
        }
        await ensureOrganizerParticipant(racedEvent.id, user.id);
        return NextResponse.json({ success: true, replayed: true, event: eventResponse(racedEvent) });
      }
    }

    if (error || !event) throw error || new Error('Failed to create event');

    await ensureOrganizerParticipant(event.id, user.id);

    return NextResponse.json({ success: true, replayed: false, event: eventResponse(event) }, { status: 201 });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

/**
 * Stamps the caller's submission state onto each event row (and strips the
 * secret columns). Exported for the route-level test.
 */
export function toSafeEventsWithSubmissionFlag(
  rows: Array<Record<string, unknown> & { id: string }>,
  submittedEventIds: Set<string> | null
) {
  return rows.map((event) => {
    const safeEvent = { ...event } as Record<string, unknown>;
    delete safeEvent.access_code;
    delete safeEvent.creation_key;
    delete safeEvent.creation_payload_hash;
    safeEvent.mySubmission = submittedEventIds ? submittedEventIds.has(event.id) : null;
    return safeEvent;
  });
}

export async function GET(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({
      success: false,
      error: 'Events API is not configured in this environment.',
    });
  }

  const supabase = createSupabase(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: true, events: [], canCreateEvents: false });
  }

  const canCreateEvents = await canCreatePitchEvents(supabase, user.id);

  const { data, error } = await supabase
    .from('pitch_events')
    .select(
      `
      *,
      pitch_event_participants!inner (
        role,
        status
      )
    `
    )
    .eq('pitch_event_participants.user_id', user.id)
    .order('event_date', { ascending: true });

  if (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch events' }, { status: 500 });
  }

  // One flag per event so founder-facing lists can answer "did I submit?"
  // without a second round trip. RLS scopes the read to the caller's rows.
  const { data: mySubmissions, error: mySubmissionsError } = await supabase
    .from('pitch_event_submissions')
    .select('event_id')
    .eq('user_id', user.id);
  if (mySubmissionsError) {
    console.error('Error fetching caller submissions for event flags:', mySubmissionsError);
  }
  // null = unknown: the UI shows no chip rather than a wrong "Not submitted".
  const submittedEventIds = mySubmissionsError
    ? null
    : new Set((mySubmissions || []).map((row) => row.event_id));

  const events = toSafeEventsWithSubmissionFlag(data || [], submittedEventIds);

  const invitations = await fetchPendingInvitationsForUser(user.email);

  return NextResponse.json({ success: true, events, canCreateEvents, invitations });
}

async function fetchPendingInvitationsForUser(email: string | null | undefined) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return [];

  const adminSupabase = createServiceSupabase();
  if (!adminSupabase) return [];

  const invitationSelect = `
      id,
      status,
      email,
      dedupe_email,
      expires_at,
      invite_code,
      pitch_events (
        id,
        slug,
        name,
        event_date
      )
    `;

  // Canonical rows carry dedupe_email; legacy duplicate rows predate the
  // backfill and have it null, so match those on the raw email column with a
  // wildcard-escaped exact ilike. Both result sets still pass through
  // filterPendingInvitationsForEmail as the DB-independent guard.
  const escapedEmail = normalizedEmail.replace(/([\\%_])/g, '\\$1');
  const [canonical, legacy] = await Promise.all([
    adminSupabase
      .from('pitch_event_invitations')
      .select(invitationSelect)
      .eq('dedupe_email', normalizedEmail)
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    adminSupabase
      .from('pitch_event_invitations')
      .select(invitationSelect)
      .is('dedupe_email', null)
      .ilike('email', escapedEmail)
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
  ]);

  // A transient failure on one lookup must not hide the other's results —
  // log independently and keep whatever succeeded.
  if (canonical.error) console.error('Error fetching pending event invitations:', canonical.error);
  if (legacy.error) console.error('Error fetching legacy event invitations:', legacy.error);
  if (canonical.error && legacy.error) return [];

  const seenIds = new Set<string>();
  const data = [...(canonical.data || []), ...(legacy.data || [])].filter((row: any) => {
    if (seenIds.has(row.id)) return false;
    seenIds.add(row.id);
    return true;
  });

  const pending = filterPendingInvitationsForEmail(data || [], normalizedEmail);

  return pending
    .map((invitation) => {
      const eventRow = Array.isArray(invitation.pitch_events)
        ? invitation.pitch_events[0]
        : invitation.pitch_events;
      if (!eventRow) return null;

      return {
        id: invitation.id,
        event: {
          id: eventRow.id,
          slug: eventRow.slug,
          name: eventRow.name,
          event_date: eventRow.event_date,
        },
        invite_url: `/events/${eventRow.slug}?invite=${invitation.invite_code}`,
      };
    })
    .filter((invitation): invitation is NonNullable<typeof invitation> => invitation !== null);
}
