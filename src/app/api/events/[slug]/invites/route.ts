import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { buildEventInviteEmail, sendEmail as dispatchEmail } from '@/lib/email';
import {
  canManageEventInvites,
  getInvitationHealth,
  MAX_BULK_FOUNDER_INVITES,
  publicInviteDeliveryError,
  publicInviteError,
} from '@/lib/event-dashboard';

const INVITE_ROLES = ['founder', 'organizer', 'admin', 'coach', 'mentor', 'judge'] as const;
const DELIVERY_STATUSES = ['unknown', 'skipped', 'sent', 'failed', 'not_configured'] as const;

const inviteCreateSchema = z.object({
  email: z.string().trim().email().optional().or(z.literal('')),
  emails: z.array(z.string().trim().email()).max(200).optional(),
  role: z.enum(INVITE_ROLES).default('founder'),
  sendEmail: z.boolean().default(true),
}).superRefine((value, context) => {
  if (value.emails?.length && value.role !== 'founder') {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Bulk invitations are available for founders only.' });
  }
  if (value.emails && new Set(value.emails.map(normalizeEmail)).size > MAX_BULK_FOUNDER_INVITES) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: `Invite up to ${MAX_BULK_FOUNDER_INVITES} founders at a time.` });
  }
});

const inviteActionSchema = z.object({
  inviteId: z.string().uuid(),
  action: z.enum(['resend', 'revoke'] as const),
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

async function getEventAndAccess(supabase: ReturnType<typeof createSupabase>, slug: string, userId: string) {
  const { data: event } = await supabase
    .from('pitch_events')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!event) return { event: null, canManage: false };

  const { data: participant } = await supabase
    .from('pitch_event_participants')
    .select('role,status')
    .eq('event_id', event.id)
    .eq('user_id', userId)
    .maybeSingle();

  return {
    event,
    canManage: canManageEventInvites(event.organizer_id, userId, participant),
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

function invitationResponse(invitation: any, inviteUrl: string) {
  return {
    ...invitation,
    invite_code: undefined,
    invite_url: inviteUrl,
    email_error: publicInviteDeliveryError(invitation.email_status),
    health: getInvitationHealth(invitation),
  };
}

async function createInvitation({
  supabase,
  request,
  event,
  user,
  email,
  role,
  sendEmail,
}: {
  supabase: ReturnType<typeof createSupabase>;
  request: NextRequest;
  event: any;
  user: { id: string; email?: string | null };
  email: string;
  role: (typeof INVITE_ROLES)[number];
  sendEmail: boolean;
}) {
  const inviteCode = createInviteCode();
  const { data: invitation, error } = await supabase
    .from('pitch_event_invitations')
    .insert({
      event_id: event.id,
      email: email || null,
      role,
      invite_code: inviteCode,
      invited_by: user.id,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error || !invitation) {
    console.error('Error creating event invitation:', error);
    return { success: false as const, email, error: publicInviteError('create') };
  }

  const inviteResult = await createOrUpdateInviteResponse({
    supabase,
    request,
    invitation,
    event,
    replyTo: user.email || undefined,
    allowSend: sendEmail,
  });

  if (inviteResult.updateError) {
    console.error('Event invite delivery status update failed:', inviteResult.updateError);
  }

  return {
    success: true as const,
    email,
    invitation: invitationResponse(inviteResult.invitation, inviteResult.inviteUrl),
    inviteUrl: inviteResult.inviteUrl,
    emailStatus: inviteResult.emailStatus,
    emailError: publicInviteDeliveryError(inviteResult.emailStatus),
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

  const emails = validation.data.emails?.length
    ? [...new Set(validation.data.emails.map(normalizeEmail))]
    : [normalizeEmail(validation.data.email)];
  const results: Awaited<ReturnType<typeof createInvitation>>[] = [];

  for (let index = 0; index < emails.length; index += 5) {
    const batch = emails.slice(index, index + 5);
    results.push(...await Promise.all(batch.map((email) => createInvitation({
      supabase,
      request,
      event,
      user,
      email,
      role: validation.data.role,
      sendEmail: validation.data.sendEmail && Boolean(email),
    }))));
  }

  if (validation.data.emails?.length) {
    const succeeded = results.filter((result) => result.success);
    return NextResponse.json({
      success: succeeded.length > 0,
      results,
      created: succeeded.length,
      failed: results.length - succeeded.length,
    }, { status: succeeded.length ? 201 : 500 });
  }

  const inviteResult = results[0];
  if (!inviteResult?.success) {
    return NextResponse.json({ success: false, error: inviteResult?.error || publicInviteError('create') }, { status: 500 });
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
  const health = getInvitationHealth(invitation);

  if (validation.data.action === 'revoke') {
    if (!health.canRevoke) {
      return NextResponse.json({ success: false, error: 'Only pending or expired invites can be revoked.' }, { status: 400 });
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
      invitation: invitationResponse(updatedInvitation, inviteUrl),
      inviteUrl,
      emailStatus: updatedInvitation?.email_status || invitation.email_status || 'unknown',
      emailError: publicInviteDeliveryError(updatedInvitation?.email_status),
    });
  }

  if (!normalizeEmail(invitation.email)) {
    return NextResponse.json({ success: false, error: 'Add an email address before resending.' }, { status: 400 });
  }
  if (!health.canResend) {
    return NextResponse.json({ success: false, error: 'Only pending or expired invites can be resent.' }, { status: 400 });
  }

  if (health.lifecycle === 'expired') {
    const { data: refreshedInvitation, error: refreshError } = await supabase
      .from('pitch_event_invitations')
      .update({ expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(), updated_at: new Date().toISOString() })
      .eq('id', invitation.id)
      .select('*')
      .single();
    if (refreshError || !refreshedInvitation) {
      console.error('Event invite expiry refresh failed:', refreshError);
      return NextResponse.json({ success: false, error: publicInviteError('resend') }, { status: 500 });
    }
    Object.assign(invitation, refreshedInvitation);
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
    invitation: invitationResponse(inviteResult.invitation, inviteResult.inviteUrl),
    inviteUrl: inviteResult.inviteUrl,
    emailStatus: inviteResult.emailStatus,
    emailError: publicInviteDeliveryError(inviteResult.emailStatus),
  });
}
