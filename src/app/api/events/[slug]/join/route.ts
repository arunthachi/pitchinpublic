import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';

const joinSchema = z.object({
  accessCode: z.string().max(64).optional().or(z.literal('')),
  inviteCode: z.string().max(64).optional().or(z.literal('')),
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

  if (event.access_code && !invitation) {
    const providedCode = validation.data.accessCode?.trim();
    if (providedCode !== event.access_code) {
      return NextResponse.json({ success: false, error: 'That invite code does not match this pitch event.' }, { status: 403 });
    }
  }

  const role = event.organizer_id === user.id ? 'organizer' : invitation?.role || 'founder';
  const { data: participant, error } = await supabase
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
