import { createHash, randomBytes, randomUUID } from 'crypto';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { normalizeEmail } from '@/lib/admin';
import { escapeHtml, sendEmail } from '@/lib/email';
import { getClientIp, rateLimit } from '@/lib/ratelimit';

const RESEND_COOLDOWN_MS = 60_000;
const DEFAULT_EXPIRY_DAYS = 30;

export type FounderInvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface FounderInvitationRow {
  id: string;
  email: string;
  normalized_email: string;
  token_hash: string;
  cohort: string | null;
  source: string | null;
  status: FounderInvitationStatus;
  invited_by: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface FounderInvitationDelivery {
  status: 'sent' | 'failed';
  failureCategory: string | null;
  attemptedAt: string;
}

export class FounderInvitationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'FounderInvitationError';
  }
}

export function founderInvitesEnabled() {
  return process.env.FOUNDER_INVITES_ENABLED?.trim().toLowerCase() !== 'false';
}

export function hashFounderInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function generateFounderInviteToken() {
  return randomBytes(32).toString('base64url');
}

function sanitizeEmailError(error?: string | null) {
  if (!error) return null;
  const lower = error.toLowerCase();
  if (lower.includes('not configured') || lower.includes('missing resend')) return 'not_configured';
  if (lower.includes('domain') || lower.includes('sender') || lower.includes('from')) return 'sender_rejected';
  if (lower.includes('rate') || lower.includes('too many')) return 'provider_rate_limited';
  if (lower.includes('invalid') || lower.includes('recipient')) return 'invalid_recipient';
  return 'provider_rejected';
}

export function publicFounderInvitation(
  row: FounderInvitationRow,
  latestDelivery: FounderInvitationDelivery | null = null
) {
  return {
    id: row.id,
    email: row.email,
    cohort: row.cohort,
    source: row.source,
    status: row.status,
    acceptedAt: row.accepted_at,
    expiresAt: row.expires_at,
    emailStatus: latestDelivery?.status || 'unknown',
    emailError: latestDelivery?.failureCategory || null,
    emailSentAt: latestDelivery?.status === 'sent' ? latestDelivery.attemptedAt : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listFounderInvitations(supabase: SupabaseClient, limit = 50) {
  const { data: invitations, error } = await supabase
    .from('founder_invitations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new FounderInvitationError(
      'Could not load founder invitations.',
      500,
      'invite_list_failed'
    );
  }

  const rows = (invitations || []) as FounderInvitationRow[];
  if (!rows.length) return [];

  const { data: attempts, error: attemptsError } = await supabase
    .from('founder_invitation_email_attempts')
    .select('invitation_id,status,failure_category,attempted_at')
    .in('invitation_id', rows.map((row) => row.id))
    .order('attempted_at', { ascending: false });

  if (attemptsError) {
    throw new FounderInvitationError(
      'Could not load founder invitation delivery status.',
      500,
      'delivery_list_failed'
    );
  }

  const latestByInvitation = new Map<string, FounderInvitationDelivery>();
  for (const attempt of attempts || []) {
    if (latestByInvitation.has(attempt.invitation_id)) continue;
    latestByInvitation.set(attempt.invitation_id, {
      status: attempt.status === 'sent' ? 'sent' : 'failed',
      failureCategory: attempt.failure_category || null,
      attemptedAt: attempt.attempted_at,
    });
  }

  return rows.map((row) =>
    publicFounderInvitation(row, latestByInvitation.get(row.id) || null)
  );
}

function requestId(request: NextRequest) {
  return request.headers.get('x-request-id')?.slice(0, 128) || randomUUID();
}

async function recordAudit(
  supabase: SupabaseClient,
  invitationId: string,
  action: string,
  actorId: string,
  requestIdentifier: string,
  metadata: Record<string, unknown> = {}
) {
  const { error } = await supabase.from('founder_invitation_audit_events').insert({
    invitation_id: invitationId,
    action,
    actor_user_id: actorId,
    request_id: requestIdentifier,
    metadata,
  });

  if (error) {
    console.error('Founder invitation audit write failed:', { action, code: error.code });
  }
}

async function recordDeliveryAttempt(
  supabase: SupabaseClient,
  invitationId: string,
  actorId: string,
  status: 'sent' | 'failed',
  failureCategory: string | null,
  requestIdentifier: string
) {
  const attemptedAt = new Date().toISOString();
  const { error } = await supabase.from('founder_invitation_email_attempts').insert({
    invitation_id: invitationId,
    attempted_by: actorId,
    provider: 'resend',
    status,
    failure_category: failureCategory,
    request_id: requestIdentifier,
    attempted_at: attemptedAt,
    completed_at: attemptedAt,
    metadata: { channel: 'founder_invite' },
  });

  if (error) {
    console.error('Founder invitation delivery audit failed:', { status, code: error.code });
  }

  return { status, failureCategory, attemptedAt } satisfies FounderInvitationDelivery;
}

function buildFounderInviteEmail(inviteUrl: string, cohort?: string | null) {
  const cohortLine = cohort ? `You are joining ${cohort} as an invited founder.` : 'You are invited to the founding Pitch in Public community.';

  return {
    subject: 'You’re invited to Pitch in Public',
    text: [
      'You’re invited to Pitch in Public.',
      '',
      cohortLine,
      'Record a short pitch, get useful founder feedback, and improve your next take.',
      '',
      `Accept your founder invite: ${inviteUrl}`,
      '',
      'This private invitation is tied to your email address.',
    ].join('\n'),
    html: `
      <div style="font-family: Inter, Arial, sans-serif; background:#050608; color:#f8fafc; padding:24px;">
        <div style="max-width:640px; margin:0 auto; border:1px solid rgba(255,255,255,.14); border-radius:24px; padding:24px; background:#0f172a;">
          <p style="color:#22d3ee; font-size:12px; letter-spacing:.18em; text-transform:uppercase; font-weight:800;">Pitch in Public founder invite</p>
          <h1 style="margin:8px 0 16px; font-size:30px;">Sharpen your pitch with other founders.</h1>
          <p style="line-height:1.7; color:#cbd5e1;">${escapeHtml(cohortLine)}</p>
          <p style="line-height:1.7; color:#cbd5e1;">Record a short pitch, get useful Toast or Roast feedback, and improve your next take.</p>
          <p style="margin:28px 0;">
            <a href="${escapeHtml(inviteUrl)}" style="display:inline-block; padding:14px 22px; border-radius:999px; background:#22d3ee; color:#020617; font-weight:900; text-decoration:none;">Accept founder invite</a>
          </p>
          <p style="font-size:13px; color:#94a3b8;">This invitation is private and tied to the email address that received it.</p>
        </div>
      </div>
    `,
  };
}

async function deliverFounderInvite({
  supabase,
  invitation,
  inviteUrl,
  actor,
  requestIdentifier,
}: {
  supabase: SupabaseClient;
  invitation: FounderInvitationRow;
  inviteUrl: string;
  actor: User;
  requestIdentifier: string;
}) {
  const result = await sendEmail({
    to: invitation.email,
    replyTo: actor.email || undefined,
    ...buildFounderInviteEmail(inviteUrl, invitation.cohort),
  });
  const failureCategory = result.ok ? null : sanitizeEmailError(result.error);
  const delivery = await recordDeliveryAttempt(
    supabase,
    invitation.id,
    actor.id,
    result.ok ? 'sent' : 'failed',
    failureCategory,
    requestIdentifier
  );

  return {
    invitation,
    delivery,
    emailStatus: result.status,
    emailError: failureCategory,
  };
}

export async function enforceFounderInviteRateLimit(
  request: NextRequest,
  actorId: string,
  destinationEmail: string,
  operation: 'create' | 'resend'
) {
  const destinationKey = hashFounderInviteToken(normalizeEmail(destinationEmail)).slice(0, 24);
  const ipKey = hashFounderInviteToken(getClientIp(request)).slice(0, 24);
  const limits = operation === 'create'
    ? [
        { key: `founder-invite:create:admin:${actorId}`, limit: 50, window: 86_400 },
        { key: `founder-invite:create:ip:${ipKey}`, limit: 30, window: 3_600 },
        { key: `founder-invite:create:email:${destinationKey}`, limit: 5, window: 3_600 },
      ]
    : [
        { key: `founder-invite:resend:admin:${actorId}`, limit: 50, window: 86_400 },
        { key: `founder-invite:resend:ip:${ipKey}`, limit: 30, window: 3_600 },
        { key: `founder-invite:resend:email:${destinationKey}`, limit: 3, window: 3_600 },
      ];

  for (const limit of limits) {
    const result = await rateLimit(limit);
    if (!result.success) {
      throw new FounderInvitationError(
        'Too many invitation attempts. Please wait and try again.',
        429,
        'rate_limited',
        { retryAfter: result.retryAfter || limit.window }
      );
    }
  }
}

export async function createFounderInvitation({
  supabase,
  actor,
  request,
  email,
  cohort,
  expiresInDays = DEFAULT_EXPIRY_DAYS,
  shouldSendEmail,
}: {
  supabase: SupabaseClient;
  actor: User;
  request: NextRequest;
  email: string;
  cohort?: string | null;
  expiresInDays?: number;
  shouldSendEmail: boolean;
}) {
  if (!founderInvitesEnabled()) {
    throw new FounderInvitationError('Founder invitations are temporarily unavailable.', 503, 'feature_disabled');
  }

  const normalizedEmail = normalizeEmail(email);
  await enforceFounderInviteRateLimit(request, actor.id, normalizedEmail, 'create');

  const { error: expirationError } = await supabase
    .from('founder_invitations')
    .update({ status: 'expired' })
    .eq('normalized_email', normalizedEmail)
    .eq('status', 'pending')
    .lte('expires_at', new Date().toISOString());

  if (expirationError) {
    throw new FounderInvitationError(
      'Could not refresh founder invitation status.',
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
    throw new FounderInvitationError('Could not verify founder access.', 500, 'membership_lookup_failed');
  }

  if (profile) {
    const { data: member, error: memberError } = await supabase
      .from('pilot_members')
      .select('user_id')
      .eq('user_id', profile.id)
      .maybeSingle();

    if (memberError) {
      throw new FounderInvitationError('Could not verify founder access.', 500, 'membership_lookup_failed');
    }
    if (member) {
      throw new FounderInvitationError('This founder already has active platform access.', 409, 'existing_member');
    }
  }

  const { data: activeInvite, error: activeError } = await supabase
    .from('founder_invitations')
    .select('*')
    .eq('normalized_email', normalizedEmail)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (activeError) {
    throw new FounderInvitationError('Could not check existing founder invitations.', 500, 'invite_lookup_failed');
  }
  if (activeInvite) {
    throw new FounderInvitationError(
      'An active invitation already exists for this email.',
      409,
      'active_invite_exists',
      { invitation: publicFounderInvitation(activeInvite as FounderInvitationRow), actions: ['resend', 'revoke'] }
    );
  }

  const token = generateFounderInviteToken();
  const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000).toISOString();
  const identifier = requestId(request);
  const { data, error } = await supabase
    .from('founder_invitations')
    .insert({
      email: normalizedEmail,
      cohort: cohort?.trim() || null,
      source: 'direct_invite',
      token_hash: hashFounderInviteToken(token),
      status: 'pending',
      invited_by: actor.id,
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new FounderInvitationError('An active invitation already exists for this email.', 409, 'active_invite_exists');
    }
    throw new FounderInvitationError('Could not create founder invitation.', 500, 'invite_create_failed');
  }

  const invitation = data as FounderInvitationRow;
  const inviteUrl = `${request.nextUrl.origin}/founder/invite?token=${encodeURIComponent(token)}`;
  await recordAudit(supabase, invitation.id, 'created', actor.id, identifier, { cohort: invitation.cohort });

  if (!shouldSendEmail) {
    return { invitation: publicFounderInvitation(invitation), inviteUrl, emailStatus: 'skipped', emailError: null };
  }

  const delivered = await deliverFounderInvite({ supabase, invitation, inviteUrl, actor, requestIdentifier: identifier });
  return {
    invitation: publicFounderInvitation(delivered.invitation, delivered.delivery),
    inviteUrl,
    emailStatus: delivered.emailStatus,
    emailError: delivered.emailError,
  };
}

export async function resendFounderInvitation({
  supabase,
  actor,
  request,
  invitationId,
}: {
  supabase: SupabaseClient;
  actor: User;
  request: NextRequest;
  invitationId: string;
}) {
  if (!founderInvitesEnabled()) {
    throw new FounderInvitationError('Founder invitations are temporarily unavailable.', 503, 'feature_disabled');
  }

  const { data, error } = await supabase.from('founder_invitations').select('*').eq('id', invitationId).maybeSingle();
  if (error || !data) throw new FounderInvitationError('Founder invitation was not found.', 404, 'not_found');
  const invitation = data as FounderInvitationRow;

  await enforceFounderInviteRateLimit(request, actor.id, invitation.email, 'resend');
  if (invitation.status !== 'pending') {
    throw new FounderInvitationError('Only pending invitations can be resent.', 400, 'not_pending');
  }
  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    throw new FounderInvitationError('This invitation has expired.', 400, 'expired');
  }
  const { data: lastAttempt, error: lastAttemptError } = await supabase
    .from('founder_invitation_email_attempts')
    .select('attempted_at')
    .eq('invitation_id', invitation.id)
    .order('attempted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastAttemptError) {
    throw new FounderInvitationError('Could not verify resend availability.', 500, 'delivery_lookup_failed');
  }
  if (lastAttempt?.attempted_at && Date.now() - new Date(lastAttempt.attempted_at).getTime() < RESEND_COOLDOWN_MS) {
    throw new FounderInvitationError('Please wait before resending this invitation.', 429, 'resend_cooldown', { retryAfter: 60 });
  }

  const token = generateFounderInviteToken();
  const identifier = requestId(request);
  const { data: rotated, error: rotateError } = await supabase
    .from('founder_invitations')
    .update({ token_hash: hashFounderInviteToken(token) })
    .eq('id', invitation.id)
    .eq('status', 'pending')
    .select('*')
    .single();

  if (rotateError) throw new FounderInvitationError('Could not rotate founder invitation.', 500, 'token_rotation_failed');

  const inviteUrl = `${request.nextUrl.origin}/founder/invite?token=${encodeURIComponent(token)}`;
  const delivered = await deliverFounderInvite({
    supabase,
    invitation: rotated as FounderInvitationRow,
    inviteUrl,
    actor,
    requestIdentifier: identifier,
  });

  await recordAudit(
    supabase,
    invitation.id,
    'resent',
    actor.id,
    identifier,
    { deliveryStatus: delivered.delivery.status }
  );

  return {
    invitation: publicFounderInvitation(delivered.invitation, delivered.delivery),
    inviteUrl,
    emailStatus: delivered.emailStatus,
    emailError: delivered.emailError,
  };
}

export async function revokeFounderInvitation({
  supabase,
  actor,
  request,
  invitationId,
}: {
  supabase: SupabaseClient;
  actor: User;
  request: NextRequest;
  invitationId: string;
}) {
  if (!founderInvitesEnabled()) {
    throw new FounderInvitationError('Founder invitations are temporarily unavailable.', 503, 'feature_disabled');
  }

  const { data, error } = await supabase
    .from('founder_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();

  if (error) throw new FounderInvitationError('Could not revoke founder invitation.', 500, 'revoke_failed');
  if (!data) throw new FounderInvitationError('Pending founder invitation was not found.', 404, 'not_found');

  await recordAudit(supabase, invitationId, 'revoked', actor.id, requestId(request));
  return { invitation: publicFounderInvitation(data as FounderInvitationRow) };
}

export function founderInvitationErrorResponse(error: unknown) {
  if (error instanceof FounderInvitationError) {
    return {
      status: error.status,
      body: { success: false, error: error.message, code: error.code, ...(error.details || {}) },
    };
  }
  console.error('Founder invitation operation failed:', error instanceof Error ? error.name : 'unknown');
  return { status: 500, body: { success: false, error: 'Founder invitation could not be processed.', code: 'unknown' } };
}
