import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';

const submissionSchema = z.object({
  pitchId: z.string().uuid(),
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

  const validation = submissionSchema.safeParse(await request.json());
  if (!validation.success) {
    return NextResponse.json({ success: false, error: 'Choose a valid pitch before submitting.' }, { status: 400 });
  }

  const { data: event, error: eventError } = await supabase
    .from('pitch_events')
    .select('*')
    .eq('slug', params.slug)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  }

  if (event.status === 'locked') {
    return NextResponse.json({ success: false, error: 'Submissions are locked for this event.' }, { status: 403 });
  }

  if (event.submission_deadline) {
    const deadline = new Date(event.submission_deadline);
    if (!Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, error: 'The submission deadline has passed for this event.' },
        { status: 403 }
      );
    }
  }

  const { data: pitch, error: pitchError } = await supabase
    .from('pitches')
    .select('id, user_id')
    .eq('id', validation.data.pitchId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single();

  if (pitchError || !pitch) {
    return NextResponse.json({ success: false, error: 'You can only submit one of your own active pitches.' }, { status: 403 });
  }

  const { data: participant } = await supabase
    .from('pitch_event_participants')
    .select('*')
    .eq('event_id', event.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!participant) {
    return NextResponse.json({ success: false, error: 'Join the pitch event before submitting a final take.' }, { status: 403 });
  }

  const { data: submission, error } = await supabase
    .from('pitch_event_submissions')
    .upsert(
      {
        event_id: event.id,
        user_id: user.id,
        pitch_id: validation.data.pitchId,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'event_id,user_id' }
    )
    .select('*')
    .single();

  if (error) {
    console.error('Error submitting final take:', error);
    return NextResponse.json({ success: false, error: 'Could not submit final take' }, { status: 500 });
  }

  return NextResponse.json({ success: true, submission });
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const supabase = createSupabase(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const { data: event } = await supabase
    .from('pitch_events')
    .select('id')
    .eq('slug', params.slug)
    .single();

  if (!event) {
    return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  }

  const { data: eventRow } = await supabase
    .from('pitch_events')
    .select('status,submission_deadline')
    .eq('id', event.id)
    .single();

  if (eventRow?.status === 'locked') {
    return NextResponse.json({ success: false, error: 'Submissions are locked for this event.' }, { status: 403 });
  }

  if (eventRow?.submission_deadline) {
    const deadline = new Date(eventRow.submission_deadline);
    if (!Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, error: 'The submission deadline has passed for this event.' },
        { status: 403 }
      );
    }
  }

  const { error } = await supabase
    .from('pitch_event_submissions')
    .delete()
    .eq('event_id', event.id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error removing final take:', error);
    return NextResponse.json({ success: false, error: 'Could not remove final take' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
