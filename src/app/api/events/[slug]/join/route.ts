import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';

const joinSchema = z.object({
  accessCode: z.string().max(64).optional().or(z.literal('')),
  inviteCode: z.string().max(64).optional().or(z.literal('')),
});

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || '';
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

function createAdminSupabase(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return createSupabase(request);

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY,
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
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { success: false, error: 'Event join is not configured in this environment.' },
      { status: 503 }
    );
  }

  const params = await props.params;
  const supabase = createSupabase(request);
  const adminSupabase = createAdminSupabase(request);

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

  const { data: existingParticipant } = await supabase
    .from('pitch_event_participants')
    .select('status,role')
    .eq('event_id', event.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingParticipant?.status === 'removed' && event.organizer_id !== user.id) {
    return NextResponse.json(
      {
        success: false,
        error: 'You were removed from this pitch room. Ask the organizer for a new invite or restored access.',
      },
      { status: 403 }
    );
  }

  const providedInviteCode = validation.data.inviteCode?.trim() || validation.data.accessCode?.trim();
  let invitation = null;

  if (providedInviteCode) {
    const { data: inviteRow } = await adminSupabase
      .from('pitch_event_invitations')
      .select('*')
      .eq('event_id', event.id)
      .eq('invite_code', providedInviteCode)
      .in('status', ['pending', 'accepted'])
      .maybeSingle();

    invitation = inviteRow;
  }

  if (event.visibility === 'private' && !invitation && !event.access_code) {
    return NextResponse.json(
      { success: false, error: 'This private pitch event requires an invite code.' },
      { status: 403 }
    );
  }

  if (invitation?.email) {
    const inviteEmail = normalizeEmail(invitation.email);
    const userEmail = normalizeEmail(user.email);

    if (inviteEmail && inviteEmail !== userEmail) {
      return NextResponse.json(
        {
          success: false,
          error: `This pitch event invite is for ${invitation.email}. Sign in with that email or ask for a new invite.`,
        },
        { status: 403 }
      );
    }
  }

  if (event.access_code) {
    const providedCode = validation.data.accessCode?.trim();
    if (providedCode !== event.access_code && !invitation) {
      return NextResponse.json(
        { success: false, error: 'That invite code does not match this pitch event.' },
        { status: 403 }
      );
    }
  }

  if (!invitation && event.visibility === 'private' && !validation.data.accessCode?.trim()) {
    return NextResponse.json(
      { success: false, error: 'This private pitch event requires an invite code.' },
      { status: 403 }
    );
  }

  const role = event.organizer_id === user.id ? 'organizer' : invitation?.role || 'founder';
  const { data: participant, error } = await adminSupabase
    .from('pitch_event_participants')
    .upsert(
      {
        event_id: event.id,
        user_id: user.id,
        role,
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

  if (invitation) {
    await adminSupabase
      .from('pitch_event_invitations')
      .update({
        status: 'accepted',
        accepted_by: user.id,
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invitation.id);
  }

  return NextResponse.json({ success: true, participant });
}
