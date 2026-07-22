import { NextRequest, NextResponse } from 'next/server';
import { createRequestSupabase, normalizeEmail } from '@/lib/admin';
import { founderInvitesEnabled } from '@/lib/founder-invitations';
import { hashFounderInviteToken } from '@/lib/founder-invitations';
import { getClientIp, rateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

const friendlyRpcError = (message?: string) => {
  const normalized = (message || '').toLowerCase();

  if (normalized.includes('email address that received')) {
    return { status: 403, code: 'email_mismatch', error: 'Use the email address that received this invitation.' };
  }
  if (normalized.includes('expired')) {
    return { status: 410, code: 'expired', error: 'This founder invitation has expired.' };
  }
  if (normalized.includes('authentication')) {
    return { status: 401, code: 'authentication_required', error: 'Sign in before accepting this invitation.' };
  }

  return {
    status: 409,
    code: 'invalid_invitation',
    error: 'This founder invitation is invalid or no longer active.',
  };
};

export async function POST(request: NextRequest) {
  if (!founderInvitesEnabled()) {
    return NextResponse.json(
      { success: false, error: 'Founder invitations are temporarily unavailable.', code: 'feature_disabled' },
      { status: 503 }
    );
  }

  const supabase = createRequestSupabase(request);
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Founder invitations are not configured in this environment.', code: 'not_configured' },
      { status: 503 }
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.email) {
    return NextResponse.json(
      { success: false, error: 'Sign in before accepting this invitation.', code: 'authentication_required' },
      { status: 401 }
    );
  }

  let token = '';
  try {
    const body = await request.json();
    token = typeof body?.token === 'string' ? body.token.trim() : '';
  } catch {
    return NextResponse.json(
      { success: false, error: 'This founder invitation is invalid or no longer active.', code: 'invalid_invitation' },
      { status: 400 }
    );
  }

  if (token.length < 32 || token.length > 256 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return NextResponse.json(
      { success: false, error: 'This founder invitation is invalid or no longer active.', code: 'invalid_invitation' },
      { status: 400 }
    );
  }

  const ipKey = hashFounderInviteToken(getClientIp(request)).slice(0, 24);
  const userKey = hashFounderInviteToken(user.id).slice(0, 24);
  const limit = await rateLimit({
    key: `founder-invite:accept:${ipKey}:${userKey}`,
    limit: 10,
    window: 900,
  });
  if (!limit.success) {
    return NextResponse.json(
      { success: false, error: 'Too many invitation attempts. Try again later.', code: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 60) } }
    );
  }

  const { data, error } = await supabase.rpc('accept_founder_invitation', {
    raw_token: token,
  });

  if (error) {
    const friendly = friendlyRpcError(error.message);
    console.warn('Founder invitation acceptance rejected:', {
      code: error.code,
      user: normalizeEmail(user.email).replace(/^(.{2}).*(@.*)$/, '$1***$2'),
      reason: friendly.code,
    });
    return NextResponse.json(
      { success: false, error: friendly.error, code: friendly.code },
      { status: friendly.status }
    );
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.accepted) {
    return NextResponse.json(
      { success: false, error: 'This founder invitation could not be accepted.', code: 'acceptance_failed' },
      { status: 409 }
    );
  }

  return NextResponse.json({
    success: true,
    invitation: {
      status: result.invitation_status || 'accepted',
      cohort: result.cohort || null,
      source: result.source || null,
    },
    redirectTo: '/',
  });
}
