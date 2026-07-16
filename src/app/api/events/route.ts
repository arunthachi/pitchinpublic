import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';

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
});

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
        error: 'Organizer access is required to create pitch rooms. Founders can join rooms from an invite link.',
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
  const baseSlug = slugify(data.name) || 'pitch-sprint';
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
  const selectedFocuses = data.focuses?.map((item) => item.trim()).filter(Boolean) || [];
  const focusSummary = selectedFocuses.length ? selectedFocuses.join(' · ') : data.focus?.trim() || 'Clarity';
  const pitchLengthSeconds = data.pitchLengthSeconds ?? Math.round((data.pitchLengthMinutes ?? 1) * 60);

  try {
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
        status: 'active',
      })
      .select('*')
      .single();

    if (error) throw error;

    const { error: participantError } = await supabase.from('pitch_event_participants').upsert({
      event_id: event.id,
      user_id: user.id,
      role: 'organizer',
      status: 'active',
    });

    if (participantError) throw participantError;

    return NextResponse.json({ success: true, event }, { status: 201 });
  } catch (error) {
    console.error('Error creating pitch room:', error);
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
    console.error('Error fetching pitch rooms:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch events' }, { status: 500 });
  }

  const events = (data || []).map((event) => {
    const safeEvent = { ...event } as Record<string, unknown>;
    delete safeEvent.access_code;
    return safeEvent;
  });

  return NextResponse.json({ success: true, events, canCreateEvents });
}
