import { createHash, randomBytes } from 'crypto';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { createServiceSupabase, normalizeEmail } from '@/lib/admin';
import { escapeHtml, sendEmail } from '@/lib/email';
import { getClientIp, rateLimit } from '@/lib/ratelimit';

const DEFAULT_EXPIRY_DAYS = 30;
const RESEND_COOLDOWN_MS = 60_000;

export type ReviewerInvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export type TrustedReviewerRole =
  | 'investor'
  | 'product_leader'
  | 'past_judge'
  | 'mentor'
  | 'operator'
  | 'other';

export interface ReviewerInvitationRow {
  id: string;
  action_key: string;
  email: string;
  normalized_email: string;
  token_hash: string;
  reviewer_roles: TrustedReviewerRole[];
  expertise: string[];
  title: string | null;
  organization: string | null;
  status: ReviewerInvitationStatus;
  invited_by: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  expires_at: string;
  email_status?: 'unknown' | 'skipped' | 'sent' | 'failed' | 'not_configured';
  email_error?: string | null;
  email_sent_at?: string | null;
  created_at: string;
  updated_at: string;
}

export class ReviewerInvitationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ReviewerInvitationError';
  }
}

export function hashReviewerInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function isValidReviewerInviteToken(token: string) {
  return token.length >= 32 && token.length <= 256 && /^[A-Za-z0-9_-]+$/.test(token);
}

function generateReviewerInviteToken() {
  return randomBytes(32).toString('base64url');
}

function publicInvitation(row: ReviewerInvitationRow) {
  return {
    actionKey: row.action_key,
    email: row.email,
    reviewerRoles: row.reviewer_roles,
    expertise: row.expertise,
    title: row.title,
    organization: row.organization,
    status: row.status,
    acceptedAt: row.accepted_at,
    expiresAt: row.expires_at,
    emailStatus: row.email_status || 'unknown',
    emailError: row.email_error || null,
    emailSentAt: row.email_sent_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildReviewerInviteEmail(inviteUrl: string) {
  return {
    subject: 'You’re invited as a trusted reviewer on Pitch in Public',
    text: [
      'You’re invited to join Pitch in Public as a trusted reviewer.',
      '',
      'Review community-published founder pitches and share clear, useful feedback.',
      'You may also receive access to selected private pitch events.',
      '',
      `Accept your reviewer invite: ${inviteUrl}`,
      '',
      'This private invitation is tied to the email address that received it.',
    ].join('\n'),
    html: `
      <div style="font-family: Inter, Arial, sans-serif; background:#050608; color:#f8fafc; padding:24px;">
        <div style="max-width:640px; margin:0 auto; border:1px solid rgba(255,255,255,.14); border-radius:24px; padding:24px; background:#0f172a;">
          <p style="color:#22d3ee; font-size:12px; letter-spacing:.18em; text-transform:uppercase; font-weight:800;">Pitch in Public trusted reviewer invite</p>
          <h1 style="margin:8px 0 16px; font-size:30px;">Help founders sharpen their pitch.</h1>
          <p style="line-height:1.7; color:#cbd5e1;">Review community-published founder pitches and share clear, useful feedback. You may also receive access to selected private pitch events.</p>
          <p style="margin:28px 0;">
            <a href="${escapeHtml(inviteUrl)}" style="display:inline-block; padding:14px 22px; border-radius:999px; background:#22d3ee; color:#020617; font-weight:900; text-decoration:none;">Accept reviewer invite</a>
          </p>
          <p style="font-size:13px; color:#94a3b8;">This invitation is private and tied to the email address that received it.</p>
        </div>
      </div>
    `,
  };
}

async function updateDeliveryStatus(
  supabase: SupabaseClient,
  invitationId: string,
  status: 'skipped' | 'sent' | 'failed' | 'not_configured',
  error: string | null
) {
  const { data, error: updateError } = await supabase
    .from('trusted_reviewer_invitations')
    .update({
      email_status: status,
      email_error: error,
      email_sent_at: status === 'sent' ? new Date().toISOString() : null,
    })
    .eq('id', invitationId)
    .select('*')
    .maybeSingle();

  if (updateError) {
    console.error('Trusted reviewer invitation delivery status update failed:', {
      code: updateError.code,
    });
  }

  return data as ReviewerInvitationRow | null;
}

async function deliverReviewerInvite(
  supabase: SupabaseClient,
  invitation: ReviewerInvitationRow,
  inviteUrl: string,
  actor: User
) {
  const result = await sendEmail({
    to: invitation.email,
    replyTo: actor.email || undefined,
    ...buildReviewerInviteEmail(inviteUrl),
  });
  const deliveryStatus = result.status === 'not_configured'
    ? 'not_configured'
    : result.ok
      ? 'sent'
      : 'failed';
  const updated = await updateDeliveryStatus(
    supabase,
    invitation.id,
    deliveryStatus,
    result.ok ? null : result.error || null
  );

  return {
    invitation: updated || invitation,
    emailStatus: result.status,
    emailError: result.ok ? null : result.error || null,
  };
}

async function enforceRateLimit(
  request: NextRequest,
  actorId: string,
  email: string,
  operation: 'create' | 'resend'
) {
  const emailKey = hashReviewerInviteToken(normalizeEmail(email)).slice(0, 24);
  const ipKey = hashReviewerInviteToken(getClientIp(request)).slice(0, 24);
  const limits = operation === 'create'
    ? [
        { key: `reviewer-invite:create:admin:${actorId}`, limit: 50, window: 86_400 },
        { key: `reviewer-invite:create:ip:${ipKey}`, limit: 30, window: 3_600 },
        { key: `reviewer-invite:create:email:${emailKey}`, limit: 5, window: 3_600 },
      ]
    : [
        { key: `reviewer-invite:resend:admin:${actorId}`, limit: 50, window: 86_400 },
        { key: `reviewer-invite:resend:ip:${ipKey}`, limit: 30, window: 3_600 },
        { key: `reviewer-invite:resend:email:${emailKey}`, limit: 3, window: 3_600 },
      ];

  for (const limit of limits) {
    const result = await rateLimit(limit);
    if (!result.success) {
      throw new ReviewerInvitationError(
        'Too many invitation attempts. Please wait and try again.',
        429,
        'rate_limited',
        { retryAfter: result.retryAfter || limit.window }
      );
    }
  }
}

export async function listReviewerInvitations(supabase: SupabaseClient, limit = 50) {
  const { data, error } = await supabase
    .from('trusted_reviewer_invitations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new ReviewerInvitationError(
      'Could not load trusted reviewer invitations.',
      500,
      'invite_list_failed'
    );
  }

  return ((data || []) as ReviewerInvitationRow[]).map(publicInvitation);
}

export async function listTrustedReviewers(supabase: SupabaseClient) {
  const { data: memberships, error } = await supabase
    .from('trusted_reviewer_memberships')
    .select('id,user_id,reviewer_roles,expertise,title,organization,status,granted_at')
    .eq('status', 'active')
    .order('granted_at', { ascending: false });

  if (error) {
    throw new ReviewerInvitationError('Could not load trusted reviewers.', 500, 'reviewer_list_failed');
  }
  if (!memberships?.length) return [];

  const membershipIds = memberships.map((membership) => membership.id);
  const userIds = memberships.map((membership) => membership.user_id);
  const [{ data: profiles, error: profileError }, { data: access, error: accessError }] = await Promise.all([
    supabase.from('profiles').select('id,email,full_name').in('id', userIds),
    supabase.from('trusted_reviewer_event_access').select('membership_id,event_id').in('membership_id', membershipIds),
  ]);

  if (profileError || accessError) {
    throw new ReviewerInvitationError('Could not load trusted reviewer access.', 500, 'reviewer_access_list_failed');
  }

  const eventIds = [...new Set((access || []).map((grant) => grant.event_id))];
  const { data: events, error: eventError } = eventIds.length
    ? await supabase.from('pitch_events').select('id,name,slug').in('id', eventIds)
    : { data: [], error: null };
  if (eventError) {
    throw new ReviewerInvitationError('Could not load trusted reviewer events.', 500, 'reviewer_event_list_failed');
  }

  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
  const eventById = new Map((events || []).map((event) => [event.id, event]));
  const accessByMembership = new Map<string, Array<{ name: string; slug: string }>>();
  for (const grant of access || []) {
    const event = eventById.get(grant.event_id);
    if (!event) continue;
    const existing = accessByMembership.get(grant.membership_id) || [];
    existing.push({ name: event.name, slug: event.slug });
    accessByMembership.set(grant.membership_id, existing);
  }

  return memberships.flatMap((membership) => {
    const profile = profileById.get(membership.user_id);
    if (!profile?.email) return [];
    return [{
      email: profile.email,
      name: profile.full_name || null,
      reviewerRoles: membership.reviewer_roles as TrustedReviewerRole[],
      expertise: membership.expertise as string[],
      title: membership.title as string | null,
      organization: membership.organization as string | null,
      grantedAt: membership.granted_at as string,
      eventAccess: accessByMembership.get(membership.id) || [],
    }];
  });
}

export async function createReviewerInvitation({
  supabase,
  actor,
  request,
  email,
  reviewerRoles,
  expertise,
  title,
  organization,
  expiresInDays = DEFAULT_EXPIRY_DAYS,
  shouldSendEmail,
}: {
  supabase: SupabaseClient;
  actor: User;
  request: NextRequest;
  email: string;
  reviewerRoles: TrustedReviewerRole[];
  expertise: string[];
  title?: string;
  organization?: string;
  expiresInDays?: number;
  shouldSendEmail: boolean;
}) {
  const normalizedEmail = normalizeEmail(email);
  await enforceRateLimit(request, actor.id, normalizedEmail, 'create');

  const { error: expirationError } = await supabase
    .from('trusted_reviewer_invitations')
    .update({ status: 'expired' })
    .eq('normalized_email', normalizedEmail)
    .eq('status', 'pending')
    .lte('expires_at', new Date().toISOString());

  if (expirationError) {
    throw new ReviewerInvitationError(
      'Could not refresh trusted reviewer invitation status.',
      500,
      'invite_expiration_failed'
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (profileError) {
    throw new ReviewerInvitationError(
      'Could not verify trusted reviewer access.',
      500,
      'membership_lookup_failed'
    );
  }

  if (profile) {
    const { data: existingMembership, error: membershipError } = await supabase
      .from('trusted_reviewer_memberships')
      .select('id')
      .eq('user_id', profile.id)
      .eq('status', 'active')
      .maybeSingle();

    if (membershipError) {
      throw new ReviewerInvitationError(
        'Could not verify trusted reviewer access.',
        500,
        'membership_lookup_failed'
      );
    }
    if (existingMembership) {
      throw new ReviewerInvitationError(
        'This trusted reviewer already has active access.',
        409,
        'existing_member'
      );
    }
  }

  const { data: activeInvite, error: activeError } = await supabase
    .from('trusted_reviewer_invitations')
    .select('*')
    .eq('normalized_email', normalizedEmail)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (activeError) {
    throw new ReviewerInvitationError(
      'Could not check existing trusted reviewer invitations.',
      500,
      'invite_lookup_failed'
    );
  }
  if (activeInvite) {
    throw new ReviewerInvitationError(
      'An active invitation already exists for this email.',
      409,
      'active_invite_exists',
      { invitation: publicInvitation(activeInvite as ReviewerInvitationRow), actions: ['resend', 'revoke'] }
    );
  }

  const token = generateReviewerInviteToken();
  const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('trusted_reviewer_invitations')
    .insert({
      email: normalizedEmail,
      reviewer_roles: reviewerRoles,
      expertise,
      title: title || null,
      organization: organization || null,
      token_hash: hashReviewerInviteToken(token),
      status: 'pending',
      invited_by: actor.id,
      expires_at: expiresAt,
      email_status: shouldSendEmail ? 'unknown' : 'skipped',
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new ReviewerInvitationError(
        'An active invitation already exists for this email.',
        409,
        'active_invite_exists'
      );
    }
    throw new ReviewerInvitationError(
      'Could not create trusted reviewer invitation.',
      500,
      'invite_create_failed'
    );
  }

  const invitation = data as ReviewerInvitationRow;
  const inviteUrl = `${request.nextUrl.origin}/reviewer/invite?token=${encodeURIComponent(token)}`;
  if (!shouldSendEmail) {
    return {
      invitation: publicInvitation(invitation),
      inviteUrl,
      emailStatus: 'skipped' as const,
      emailError: null,
    };
  }

  const delivered = await deliverReviewerInvite(supabase, invitation, inviteUrl, actor);
  return {
    invitation: publicInvitation(delivered.invitation),
    inviteUrl,
    emailStatus: delivered.emailStatus,
    emailError: delivered.emailError,
  };
}

export async function resendReviewerInvitation({
  supabase,
  actor,
  request,
  actionKey,
}: {
  supabase: SupabaseClient;
  actor: User;
  request: NextRequest;
  actionKey: string;
}) {
  const { data, error } = await supabase
    .from('trusted_reviewer_invitations')
    .select('*')
    .eq('action_key', actionKey)
    .maybeSingle();

  if (error || !data) {
    throw new ReviewerInvitationError(
      'Trusted reviewer invitation was not found.',
      404,
      'not_found'
    );
  }

  const invitation = data as ReviewerInvitationRow;
  await enforceRateLimit(request, actor.id, invitation.email, 'resend');
  if (invitation.status !== 'pending') {
    throw new ReviewerInvitationError(
      'Only pending invitations can be resent.',
      400,
      'not_pending'
    );
  }
  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    throw new ReviewerInvitationError('This invitation has expired.', 400, 'expired');
  }
  if (
    invitation.email_sent_at &&
    Date.now() - new Date(invitation.email_sent_at).getTime() < RESEND_COOLDOWN_MS
  ) {
    throw new ReviewerInvitationError(
      'Please wait before resending this invitation.',
      429,
      'resend_cooldown',
      { retryAfter: 60 }
    );
  }

  const token = generateReviewerInviteToken();
  const { data: rotated, error: rotateError } = await supabase
    .from('trusted_reviewer_invitations')
    .update({ token_hash: hashReviewerInviteToken(token) })
    .eq('id', invitation.id)
    .eq('status', 'pending')
    .select('*')
    .single();

  if (rotateError) {
    throw new ReviewerInvitationError(
      'Could not rotate trusted reviewer invitation.',
      500,
      'token_rotation_failed'
    );
  }

  const inviteUrl = `${request.nextUrl.origin}/reviewer/invite?token=${encodeURIComponent(token)}`;
  const delivered = await deliverReviewerInvite(
    supabase,
    rotated as ReviewerInvitationRow,
    inviteUrl,
    actor
  );
  return {
    invitation: publicInvitation(delivered.invitation),
    inviteUrl,
    emailStatus: delivered.emailStatus,
    emailError: delivered.emailError,
  };
}

export async function revokeReviewerInvitation({
  supabase,
  actionKey,
}: {
  supabase: SupabaseClient;
  actionKey: string;
}) {
  const { data, error } = await supabase
    .from('trusted_reviewer_invitations')
    .update({ status: 'revoked' })
    .eq('action_key', actionKey)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();

  if (error) {
    throw new ReviewerInvitationError(
      'Could not revoke trusted reviewer invitation.',
      500,
      'revoke_failed'
    );
  }
  if (!data) {
    throw new ReviewerInvitationError(
      'Pending trusted reviewer invitation was not found.',
      404,
      'not_found'
    );
  }

  return { invitation: publicInvitation(data as ReviewerInvitationRow) };
}

export async function resolveReviewerInvitation(rawToken: string) {
  const token = rawToken.trim();
  if (!isValidReviewerInviteToken(token)) {
    throw new ReviewerInvitationError(
      'This trusted reviewer invitation is invalid or unavailable.',
      404,
      'invalid_invitation'
    );
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    throw new ReviewerInvitationError(
      'Trusted reviewer invitations are not configured in this environment.',
      503,
      'not_configured'
    );
  }

  const tokenHash = hashReviewerInviteToken(token);
  const { data, error } = await supabase
    .from('trusted_reviewer_invitations')
    .select('email,status,expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error) {
    console.error('Trusted reviewer invitation resolve failed:', { code: error.code });
    throw new ReviewerInvitationError(
      'Could not check this trusted reviewer invitation.',
      500,
      'resolve_failed'
    );
  }
  if (!data) {
    throw new ReviewerInvitationError(
      'This trusted reviewer invitation is invalid or unavailable.',
      404,
      'invalid_invitation'
    );
  }

  let status = data.status as ReviewerInvitationStatus;
  if (status === 'pending' && new Date(data.expires_at).getTime() <= Date.now()) {
    status = 'expired';
    const { error: expiryError } = await supabase
      .from('trusted_reviewer_invitations')
      .update({ status: 'expired' })
      .eq('token_hash', tokenHash)
      .eq('status', 'pending');
    if (expiryError) {
      console.error('Trusted reviewer invitation expiry update failed:', {
        code: expiryError.code,
      });
    }
  }

  return { email: normalizeEmail(data.email), status };
}

export function reviewerInvitationErrorResponse(error: unknown) {
  if (error instanceof ReviewerInvitationError) {
    return {
      status: error.status,
      body: {
        success: false,
        error: error.message,
        code: error.code,
        ...(error.details || {}),
      },
    };
  }

  console.error(
    'Trusted reviewer invitation operation failed:',
    error instanceof Error ? error.name : 'unknown'
  );
  return {
    status: 500,
    body: {
      success: false,
      error: 'Trusted reviewer invitation could not be processed.',
      code: 'unknown',
    },
  };
}
