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

  const { data: submissionResult, error } = await supabase.rpc(
    'submit_legacy_event_final_take_atomic',
    { target_event_id: event.id, target_pitch_id: pitch.id },
  );

  if (error) {
    console.error('Error submitting final take:', error);
    if (error.message.includes('Active event participation required')) {
      return NextResponse.json({ success: false, error: 'Join the pitch event before submitting a final take.' }, { status: 403 });
    }
    if (error.message.includes('Event submissions are closed')) {
      return NextResponse.json({ success: false, error: 'Submissions are locked for this event.' }, { status: 403 });
    }
    if (error.message.includes('Pitch not found or not owned by caller') || error.message.includes('Pitch is already bound to another event')) {
      return NextResponse.json({ success: false, error: 'You can only submit one of your own active pitches for this event.' }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'Could not submit final take' }, { status: 500 });
  }

  const atomicResult = (Array.isArray(submissionResult) ? submissionResult[0] : submissionResult) as Record<string, unknown> | null;
  if (!atomicResult?.submission || typeof atomicResult.submission !== 'object' || typeof atomicResult.pitch_id !== 'string') {
    console.error('Atomic final take submission returned an invalid response');
    return NextResponse.json({ success: false, error: 'Could not submit final take' }, { status: 500 });
  }

  return NextResponse.json(buildSubmissionSuccessResponse(
    atomicResult.submission as Record<string, unknown>,
    {
      id: atomicResult.pitch_id,
      public_id: typeof atomicResult.public_id === 'string' ? atomicResult.public_id : null,
    },
    atomicResult.visibility_changed === true,
  ));
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

  const { error } = await supabase.rpc('delete_my_event_submission_locked', {
    target_event_id: event.id,
  });

  if (error) {
    console.error('Error removing final take:', error);
    if (/locked|deadline has passed/i.test(error.message || '')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'Could not remove final take' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
