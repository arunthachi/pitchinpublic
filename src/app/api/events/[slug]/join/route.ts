import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';

const joinSchema = z.object({
  accessCode: z.string().max(64).optional().or(z.literal('')),
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

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const supabase = createSupabase(request);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const validation = joinSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json({ success: false, error: 'Invalid join request' }, { status: 400 });
  }

  const { data: event, error: eventError } = await supabase
    .from('pitch_events')
    .select('*')
    .eq('slug', params.slug)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  }

  if (event.access_code) {
    const providedCode = validation.data.accessCode?.trim();
    if (providedCode !== event.access_code) {
      return NextResponse.json({ success: false, error: 'That invite code does not match this pitch event.' }, { status: 403 });
    }
  }

  const { data: participant, error } = await supabase
    .from('pitch_event_participants')
    .upsert(
      {
        event_id: event.id,
        user_id: user.id,
        role: event.organizer_id === user.id ? 'organizer' : 'founder',
        status: 'active',
      },
      { onConflict: 'event_id,user_id' }
    )
    .select('*')
    .single();

  if (error) {
    console.error('Error joining pitch event:', error);
    return NextResponse.json({ success: false, error: 'Could not join event' }, { status: 500 });
  }

  return NextResponse.json({ success: true, participant });
}
