import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { createServiceSupabase, normalizeEmail } from '@/lib/admin';
import { filterPendingInvitationsForEmail, hashEventCreationPayload, parseEventIdempotencyKey, toSafeEventsWithSubmissionFlag } from './_server';

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
  // Defaults on: an event is a feedback circle unless the organizer says
  // otherwise (a competition, where peer review is a conflict of interest).
  peerFeedbackEnabled: z.boolean().default(true),
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
  const creationKey = idempotency.key || randomUUID();
  const creationPayloadHash = hashEventCreationPayload(data);
  const selectedFocuses = data.focuses?.map((item) => item.trim()).filter(Boolean) || [];
  const focusSummary = selectedFocuses.length ? selectedFocuses.join(' · ') : data.focus?.trim() || 'Clarity';
  const pitchLengthSeconds = data.pitchLengthSeconds ?? Math.round((data.pitchLengthMinutes ?? 1) * 60);

  try {
    const { data: result, error } = await supabase.rpc('create_event_with_standard_draft', {
      event_payload: { ...data, pitchLengthSeconds, focus: focusSummary }, request_key: creationKey, payload_hash: creationPayloadHash,
    });
    const event = result?.event as Record<string, unknown> | undefined;
    if (error || !event) throw error || new Error('Failed to create event');
    return NextResponse.json({ success: true, replayed: Boolean(result.replayed), event: eventResponse(event) }, { status: 201 });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
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
