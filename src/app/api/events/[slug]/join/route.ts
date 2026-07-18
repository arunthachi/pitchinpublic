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

  // A private event is intentionally hidden by RLS until membership exists, so
  // resolve it server-side and enforce the invite/access checks below.
  const { data: event, error: eventError } = await adminSupabase
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
    const { data: inviteRow, error: inviteError } = await adminSupabase
      .from('pitch_event_invitations')
      .select('*')
      .eq('event_id', event.id)
      .eq('invite_code', providedInviteCode)
      .in('status', ['pending', 'accepted'])
      .maybeSingle();

    if (inviteError) {
      console.error('Error resolving pitch event invitation:', inviteError);
      return NextResponse.json(
        { success: false, error: 'Could not verify this event invite. Please try again.' },
        { status: 500 }
      );
    }

    invitation = inviteRow;
  }

  const suppliedAccessCodeMatches = Boolean(
    event.access_code && validation.data.accessCode?.trim() === event.access_code
  );
  const isExistingMember = Boolean(
    existingParticipant && existingParticipant.status !== 'removed'
  );
  const isOrganizer = event.organizer_id === user.id;
  const isInviteOnly = event.visibility === 'private' || event.visibility === 'unlisted';

  // Never ignore a supplied but invalid bearer code. Otherwise an unlisted URL
  // can accidentally turn a typo, expired invite, or guessed code into access.
  if (providedInviteCode && !invitation && !suppliedAccessCodeMatches) {
    return NextResponse.json(
      { success: false, error: 'That invite is invalid, expired, or already used.' },
      { status: 403 }
    );
  }

  if (
    isInviteOnly &&
    !isOrganizer &&
    !isExistingMember &&
    !invitation &&
    !suppliedAccessCodeMatches
  ) {
    return NextResponse.json(
      { success: false, error: 'This pitch event requires an invitation.' },
      { status: 403 }
    );
  }

  if (invitation?.expires_at && new Date(invitation.expires_at).getTime() <= Date.now()) {
    return NextResponse.json(
      { success: false, error: 'This pitch event invite has expired.' },
      { status: 403 }
    );
  }

  if (invitation?.status === 'accepted' && invitation.accepted_by !== user.id) {
    return NextResponse.json(
      { success: false, error: 'This pitch event invite has already been used.' },
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
    const acceptedEmail = normalizeEmail(invitation.email) || normalizeEmail(user.email);
    const { error: invitationError } = await adminSupabase
      .from('pitch_event_invitations')
      .update({
        email: acceptedEmail || null,
        status: 'accepted',
        accepted_by: user.id,
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invitation.id)
      .select('id')
      .single();

    if (invitationError) {
      console.error('Error consuming pitch event invitation:', invitationError);

      // Do not leave a newly-created membership behind while its bearer link
      // remains reusable. Existing members are preserved.
      if (!existingParticipant) {
        const { error: rollbackError } = await adminSupabase
          .from('pitch_event_participants')
          .delete()
          .eq('event_id', event.id)
          .eq('user_id', user.id);

        if (rollbackError) {
          console.error('Error rolling back partial event join:', rollbackError);
        }
      }

      return NextResponse.json(
        { success: false, error: 'Could not accept this event invite. Please try again.' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true, participant });
}
