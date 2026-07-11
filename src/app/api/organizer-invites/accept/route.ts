import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { z } from 'zod';

const acceptInviteSchema = z.object({
  code: z.string().trim().min(6).max(96),
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

function createServiceClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeEmail(email?: string | null) {
  return (email || '').trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  const validation = acceptInviteSchema.safeParse(await request.json().catch(() => ({})));

  if (!validation.success) {
    return NextResponse.json({ success: false, error: 'Enter a valid organizer invite code.' }, { status: 400 });
  }

  const supabase = createSupabase(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Sign in before accepting your organizer invite.' }, { status: 401 });
  }

  const adminSupabase = createServiceClient();

  if (!adminSupabase) {
    return NextResponse.json(
      { success: false, error: 'Organizer invites are not configured in this environment.' },
      { status: 503 }
    );
  }

  const { data: invitation, error: inviteError } = await adminSupabase
    .from('organizer_invitations')
    .select('*')
    .eq('invite_code', validation.data.code)
    .maybeSingle();

  if (inviteError) {
    console.error('Organizer invite lookup failed:', inviteError);
    return NextResponse.json({ success: false, error: 'Could not check that invite. Try again.' }, { status: 500 });
  }

  if (!invitation) {
    return NextResponse.json({ success: false, error: 'That organizer invite code was not found.' }, { status: 404 });
  }

  if (invitation.status !== 'pending') {
    const error = invitation.status === 'accepted'
      ? 'That organizer invite has already been used.'
      : 'That organizer invite is no longer active.';
    return NextResponse.json({ success: false, error }, { status: 409 });
  }

  if (invitation.expires_at && new Date(invitation.expires_at).getTime() < Date.now()) {
    await adminSupabase
      .from('organizer_invitations')
      .update({ status: 'expired' })
      .eq('id', invitation.id);

    return NextResponse.json({ success: false, error: 'That organizer invite has expired.' }, { status: 410 });
  }

  const inviteEmail = normalizeEmail(invitation.email);
  const userEmail = normalizeEmail(user.email);

  if (inviteEmail && inviteEmail !== userEmail) {
    return NextResponse.json(
      {
        success: false,
        error: `This organizer invite is for ${invitation.email}. Sign in with that email or ask for a new invite.`,
      },
      { status: 403 }
    );
  }

  const { error: roleError } = await adminSupabase
    .from('profile_roles')
    .upsert(
      {
        user_id: user.id,
        role: 'organizer',
        is_primary: true,
      },
      { onConflict: 'user_id,role' }
    );

  if (roleError) {
    console.error('Organizer role grant failed:', roleError);
    return NextResponse.json({ success: false, error: 'Could not enable organizer access.' }, { status: 500 });
  }

  const { error: updateError } = await adminSupabase
    .from('organizer_invitations')
    .update({
      status: 'accepted',
      accepted_by: user.id,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invitation.id);

  if (updateError) {
    console.error('Organizer invite acceptance update failed:', updateError);
  }

  return NextResponse.json({
    success: true,
    message: 'Organizer access enabled.',
    redirectTo: '/events/new?organizer=accepted',
  });
}
