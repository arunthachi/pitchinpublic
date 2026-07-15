import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { buildEventInviteEmail, sendEmail as dispatchEmail } from '@/lib/email';

const TEAM_MANAGER_ROLES = ['organizer', 'admin'] as const;
const INVITE_ROLES = ['founder', 'organizer', 'admin', 'coach', 'mentor', 'judge'] as const;
const DELIVERY_STATUSES = ['unknown', 'skipped', 'sent', 'failed', 'not_configured'] as const;

const inviteCreateSchema = z.object({
  email: z.string().trim().email().optional().or(z.literal('')),
  role: z.enum(INVITE_ROLES).default('founder'),
  sendEmail: z.boolean().default(true),
});

const inviteActionSchema = z.object({
  inviteId: z.string().uuid(),
  action: z.enum(['resend', 'clear_delivery', 'revoke'] as const),
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

function createInviteCode() {
  return randomBytes(5).toString('hex').toUpperCase();
}

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || '';
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

  return 'Could not create invite.';
}

async function getEventAndAccess(supabase: ReturnType<typeof createSupabase>, slug: string, userId: string) {
  const { data: event } = await supabase
    .from('pitch_events')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!event) return { event: null, canManage: false };

  if (event.organizer_id === userId) {
    return { event, canManage: true };
  }

  const { data: participant } = await supabase
    .from('pitch_event_participants')
    .select('role,status')
    .eq('event_id', event.id)
    .eq('user_id', userId)
    .maybeSingle();

  return {
    event,
    canManage: participant?.status === 'active' && TEAM_MANAGER_ROLES.includes(participant.role),
  };
}

async function updateInviteDelivery(
  supabase: ReturnType<typeof createSupabase>,
  invitationId: string,
  patch: { email_status?: (typeof DELIVERY_STATUSES)[number]; email_error?: string | null; email_sent_at?: string | null; status?: string }
) {
  return supabase
    .from('pitch_event_invitations')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invitationId)
    .select('*')
    .single();
}

async function sendInviteEmail({
  request,
  invitation,
  event,
  replyTo,
}: {
  request: NextRequest;
  invitation: {
    email: string | null;
    invite_code: string;
    role: string;
  };
  event: {
    name: string;
    description: string | null;
    pitch_length_seconds: number | null;
    submission_deadline: string | null;
    slug: string;
  };
  replyTo?: string;
}) {
  const inviteUrl = `${request.nextUrl.origin}/events/${event.slug}?invite=${invitation.invite_code}`;
  const emailResult = await dispatchEmail({
    to: invitation.email || '',
    replyTo,
    ...buildEventInviteEmail({
      eventName: event.name,
      inviteUrl,
      pitchLengthSeconds: event.pitch_length_seconds,
      submissionDeadline: event.submission_deadline,
      role: invitation.role,
      eventDescription: event.description,
    }),
  });

  return {
    inviteUrl,
    emailStatus: emailResult.status,
    emailError: emailResult.ok ? null : emailResult.error,
    emailSentAt: emailResult.ok ? new Date().toISOString() : null,
  };
}

async function createOrUpdateInviteResponse({
  supabase,
  request,
  invitation,
  event,
  replyTo,
  allowSend,
}: {
  supabase: ReturnType<typeof createSupabase>;
  request: NextRequest;
  invitation: any;
  event: any;
  replyTo?: string;
  allowSend: boolean;
}) {
  const inviteUrl = `${request.nextUrl.origin}/events/${event.slug}?invite=${invitation.invite_code}`;
  const shouldSend = allowSend && Boolean(normalizeEmail(invitation.email));

  if (!shouldSend) {
    const emailStatus = 'skipped' as const;
    const { data: updatedInvitation, error: updateError } = await updateInviteDelivery(supabase, invitation.id, {
      email_status: emailStatus,
      email_error: null,
      email_sent_at: null,
    });

    return {
      invitation: updatedInvitation || invitation,
      inviteUrl,
      emailStatus,
      emailError: null,
      emailSentAt: null,
      updateError,
    };
  }

  const emailResult = await sendInviteEmail({
    request,
    invitation,
    event,
    replyTo,
  });

  const { data: updatedInvitation, error: updateError } = await updateInviteDelivery(supabase, invitation.id, {
    email_status: emailResult.emailStatus,
    email_error: emailResult.emailError,
    email_sent_at: emailResult.emailSentAt,
  });

  return {
    invitation: updatedInvitation || invitation,
    ...emailResult,
    updateError,
  };
}

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { success: false, error: 'Event invites are not configured in this environment.' },
      { status: 503 }
    );
  }

  const params = await props.params;
  const supabase = createSupabase(request);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const validation = inviteCreateSchema.safeParse(await request.json().catch(() => ({})));
  if (!validation.success) {
    return NextResponse.json({ success: false, error: 'Add a valid email and role.' }, { status: 400 });
  }

  const { event, canManage } = await getEventAndAccess(supabase, params.slug, user.id);
  if (!event) {
    return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  }
  if (!canManage) {
    return NextResponse.json({ success: false, error: 'Only event organizers and admins can create invites.' }, { status: 403 });
  }

  const inviteCode = createInviteCode();
  const { data: invitation, error } = await supabase
    .from('pitch_event_invitations')
    .insert({
      event_id: event.id,
      email: validation.data.email || null,
      role: validation.data.role,
      invite_code: inviteCode,
      invited_by: user.id,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error creating event invitation:', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }

  const inviteResult = await createOrUpdateInviteResponse({
    supabase,
    request,
    invitation,
    event,
    replyTo: user.email || undefined,
    allowSend: validation.data.sendEmail,
  });

  if (inviteResult.updateError) {
    console.error('Event invite delivery status update failed:', inviteResult.updateError);
  }

  return NextResponse.json(
    {
      success: true,
      invitation: inviteResult.invitation,
      inviteUrl: inviteResult.inviteUrl,
      emailStatus: inviteResult.emailStatus,
      emailError: inviteResult.emailError,
    },
    { status: 201 }
  );
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { success: false, error: 'Event invites are not configured in this environment.' },
      { status: 503 }
    );
  }

  const params = await props.params;
  const supabase = createSupabase(request);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const validation = inviteActionSchema.safeParse(await request.json().catch(() => ({})));
  if (!validation.success) {
    return NextResponse.json({ success: false, error: 'Choose a valid invite action.' }, { status: 400 });
  }

  const { event, canManage } = await getEventAndAccess(supabase, params.slug, user.id);
  if (!event) {
    return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  }
  if (!canManage) {
    return NextResponse.json({ success: false, error: 'Only event organizers and admins can manage invites.' }, { status: 403 });
  }

  const { data: invitation, error: inviteError } = await supabase
    .from('pitch_event_invitations')
    .select('*')
    .eq('id', validation.data.inviteId)
    .eq('event_id', event.id)
    .maybeSingle();

  if (inviteError) {
    console.error('Event invite lookup failed:', inviteError);
    return NextResponse.json({ success: false, error: 'Could not load that invite.' }, { status: 500 });
  }

  if (!invitation) {
    return NextResponse.json({ success: false, error: 'Invite not found.' }, { status: 404 });
  }

  const inviteUrl = `${request.nextUrl.origin}/events/${event.slug}?invite=${invitation.invite_code}`;

  if (validation.data.action === 'clear_delivery') {
    const { data: updatedInvitation, error: updateError } = await updateInviteDelivery(supabase, invitation.id, {
      email_status: 'unknown',
      email_error: null,
      email_sent_at: null,
    });

    if (updateError) {
      console.error('Event invite clear delivery update failed:', updateError);
      return NextResponse.json({ success: false, error: 'Could not clear delivery status.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      invitation: updatedInvitation,
      inviteUrl,
      emailStatus: updatedInvitation?.email_status || 'unknown',
      emailError: null,
    });
  }

  if (validation.data.action === 'revoke') {
    if (invitation.status !== 'pending') {
      return NextResponse.json({ success: false, error: 'Only pending invites can be revoked.' }, { status: 400 });
    }

    const { data: updatedInvitation, error: updateError } = await updateInviteDelivery(supabase, invitation.id, {
      status: 'revoked',
    });

    if (updateError) {
      console.error('Event invite revoke failed:', updateError);
      return NextResponse.json({ success: false, error: 'Could not revoke the invite.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      invitation: updatedInvitation,
      inviteUrl,
      emailStatus: updatedInvitation?.email_status || invitation.email_status || 'unknown',
      emailError: updatedInvitation?.email_error || null,
    });
  }

  if (!normalizeEmail(invitation.email)) {
    return NextResponse.json({ success: false, error: 'Add an email address before resending.' }, { status: 400 });
  }
  if (invitation.status !== 'pending') {
    return NextResponse.json({ success: false, error: 'Only pending invites can be resent.' }, { status: 400 });
  }

  const inviteResult = await createOrUpdateInviteResponse({
    supabase,
    request,
    invitation,
    event,
    replyTo: user.email || undefined,
    allowSend: true,
  });

  if (inviteResult.updateError) {
    console.error('Event invite resend status update failed:', inviteResult.updateError);
  }

  return NextResponse.json({
    success: true,
    invitation: inviteResult.invitation,
    inviteUrl: inviteResult.inviteUrl,
    emailStatus: inviteResult.emailStatus,
    emailError: inviteResult.emailError,
  });
}
