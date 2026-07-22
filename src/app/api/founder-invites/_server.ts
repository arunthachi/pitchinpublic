import { createHash } from 'crypto';
import { createServiceSupabase, normalizeEmail } from '@/lib/admin';
import { founderInvitesEnabled } from '@/lib/founder-invitations';

export type FounderInviteResolution = {
  email: string;
  cohort: string | null;
  source: string | null;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  inviterDisplay: string;
};

export class FounderInviteResolveError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
    this.name = 'FounderInviteResolveError';
  }
}

const isValidRawToken = (token: string) =>
  token.length >= 32 && token.length <= 256 && /^[A-Za-z0-9_-]+$/.test(token);

export function getFounderInviteTokenFromNextPath(nextPath?: string | null) {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) return null;

  try {
    const url = new URL(nextPath, 'https://pitchinpublic.local');
    if (url.pathname !== '/founder/invite') return null;

    const token = (url.searchParams.get('token') || '').trim();
    return isValidRawToken(token) ? token : null;
  } catch {
    return null;
  }
}

export async function resolveFounderInviteToken(rawToken: string): Promise<FounderInviteResolution> {
  if (!founderInvitesEnabled()) {
    throw new FounderInviteResolveError(
      'Founder invitations are temporarily unavailable.',
      503,
      'feature_disabled'
    );
  }

  const token = rawToken.trim();
  if (!isValidRawToken(token)) {
    throw new FounderInviteResolveError(
      'This founder invitation is invalid or unavailable.',
      404,
      'invalid_invitation'
    );
  }

  const adminSupabase = createServiceSupabase();
  if (!adminSupabase) {
    throw new FounderInviteResolveError(
      'Founder invitations are not configured in this environment.',
      503,
      'not_configured'
    );
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const { data: invitation, error } = await adminSupabase
    .from('founder_invitations')
    .select('email,cohort,source,status,invited_by,expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error) {
    console.error('Founder invitation resolve failed:', { code: error.code });
    throw new FounderInviteResolveError(
      'Could not check this founder invitation.',
      500,
      'resolve_failed'
    );
  }

  if (!invitation) {
    throw new FounderInviteResolveError(
      'This founder invitation is invalid or unavailable.',
      404,
      'invalid_invitation'
    );
  }

  let status = invitation.status as FounderInviteResolution['status'];
  if (status === 'pending' && new Date(invitation.expires_at).getTime() <= Date.now()) {
    status = 'expired';
    const { error: expiryError } = await adminSupabase
      .from('founder_invitations')
      .update({ status: 'expired' })
      .eq('token_hash', tokenHash)
      .eq('status', 'pending');

    if (expiryError) {
      console.error('Founder invitation expiry update failed:', { code: expiryError.code });
    }
  }

  let inviterDisplay = 'Pitch in Public';
  if (invitation.invited_by) {
    const { data: inviter, error: inviterError } = await adminSupabase
      .from('profiles')
      .select('full_name')
      .eq('id', invitation.invited_by)
      .maybeSingle();

    if (inviterError) {
      console.error('Founder invitation inviter lookup failed:', { code: inviterError.code });
    } else if (inviter?.full_name?.trim()) {
      inviterDisplay = inviter.full_name.trim();
    }
  }

  return {
    email: normalizeEmail(invitation.email),
    cohort: invitation.cohort?.trim() || null,
    source: invitation.source?.trim() || null,
    status,
    inviterDisplay,
  };
}
