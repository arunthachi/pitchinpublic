import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { buildSubmissionSuccessResponse } from './_server';

const submissionSchema = z.object({
  pitchId: z.string().uuid().optional(),
  pitchPublicId: z.string().min(3).max(80).optional(),
}).refine((value) => value.pitchId || value.pitchPublicId, {
  message: 'Choose a valid pitch before submitting.',
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

  if (event.guidance_mode === 'structured_active') {
    let targetPitchId = validation.data.pitchId;
    if (!targetPitchId && validation.data.pitchPublicId) {
      const { data: resolved } = await supabase.from('pitches').select('id').eq('public_id', validation.data.pitchPublicId).eq('user_id', user.id).maybeSingle();
      targetPitchId = resolved?.id;
    }
    if (!targetPitchId) return NextResponse.json({ success: false, error: 'You can only submit one of your own active pitches.' }, { status: 403 });
    const { data: submission, error } = await supabase.rpc('submit_structured_event_final_take', { target_event_id: event.id, target_pitch_id: targetPitchId });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    return NextResponse.json(buildSubmissionSuccessResponse(submission, { id: targetPitchId }, false));
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

  let pitchQuery = supabase
    .from('pitches')
    .select('id, public_id, user_id, event_id, visibility')
    .eq('user_id', user.id)
    .is('deleted_at', null);

  pitchQuery = validation.data.pitchId
    ? pitchQuery.eq('id', validation.data.pitchId)
    : pitchQuery.eq('public_id', validation.data.pitchPublicId);

  const { data: pitch, error: pitchError } = await pitchQuery.single();

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
        pitch_id: pitch.id,
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

  // Submitting binds the pitch to this event and makes it private the first
  // time, matching the record-from-event path. A pitch already bound to an
  // event keeps its current visibility — the founder may have shared it to
  // the feed deliberately, and that stays their call. When a previously
  // public take is privatized here, the response says so and the UI tells
  // the founder rather than pulling it from the feed silently.
  let visibilityChanged = false;
  if (!pitch.event_id) {
    const wasPublic = pitch.visibility === 'public';
    const { error: bindError } = await supabase
      .from('pitches')
      .update({ event_id: event.id, visibility: 'private', updated_at: new Date().toISOString() })
      .eq('id', pitch.id)
      .eq('user_id', user.id);
    if (bindError) {
      console.error('Could not bind submitted pitch to the event:', bindError);
    } else {
      visibilityChanged = wasPublic;
    }
  }

  return NextResponse.json(buildSubmissionSuccessResponse(submission, pitch, visibilityChanged));
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
