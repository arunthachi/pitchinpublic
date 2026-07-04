import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';

const createEventSchema = z.object({
  name: z.string().min(3).max(120).trim(),
  description: z.string().max(1000).optional().or(z.literal('')),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  submissionDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  pitchLengthSeconds: z.number().min(30).max(180).default(60),
  focus: z.string().min(2).max(80).default('clarity'),
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

export async function POST(request: NextRequest) {
  const supabase = createSupabase(request);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
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
        pitch_length_seconds: data.pitchLengthSeconds,
        focus: data.focus,
        visibility: data.visibility,
        access_code: data.accessCode || null,
        status: 'active',
      })
      .select('*')
      .single();

    if (error) throw error;

    await supabase.from('pitch_event_participants').upsert({
      event_id: event.id,
      user_id: user.id,
      role: 'organizer',
      status: 'active',
    });

    return NextResponse.json({ success: true, event }, { status: 201 });
  } catch (error) {
    console.error('Error creating pitch event:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create event' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const supabase = createSupabase(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: true, events: [] });
  }

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
    console.error('Error fetching pitch events:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch events' }, { status: 500 });
  }

  return NextResponse.json({ success: true, events: data || [] });
}
