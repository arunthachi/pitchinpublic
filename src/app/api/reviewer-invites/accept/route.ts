import { NextRequest, NextResponse } from 'next/server';
import { createRequestSupabase, normalizeEmail } from '@/lib/admin';
import { getClientIp, rateLimit } from '@/lib/ratelimit';
import {
  hashReviewerInviteToken,
  isValidReviewerInviteToken,
  resolveReviewerInvitation,
  ReviewerInvitationError,
} from '@/lib/reviewer-invitations';

export const dynamic = 'force-dynamic';

function friendlyRpcError(message?: string) {
  const normalized = (message || '').toLowerCase();
  if (normalized.includes('email')) {
    return {
      status: 403,
      code: 'email_mismatch',
      error: 'Use the email address that received this invitation.',
    };
  }
  if (normalized.includes('expired')) {
    return { status: 410, code: 'expired', error: 'This trusted reviewer invitation has expired.' };
  }
  if (normalized.includes('authentication')) {
    return {
      status: 401,
      code: 'authentication_required',
      error: 'Sign in before accepting this invitation.',
    };
  }
  return {
    status: 409,
    code: 'invalid_invitation',
    error: 'This trusted reviewer invitation is invalid or no longer active.',
  };
}

export async function POST(request: NextRequest) {
  const supabase = createRequestSupabase(request);
  if (!supabase) {
    return NextResponse.json(
      {
        success: false,
        error: 'Trusted reviewer invitations are not configured in this environment.',
        code: 'not_configured',
      },
      { status: 503 }
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.email) {
    return NextResponse.json(
      {
        success: false,
        error: 'Sign in before accepting this invitation.',
        code: 'authentication_required',
      },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const token = typeof body?.token === 'string' ? body.token.trim() : '';
  if (!isValidReviewerInviteToken(token)) {
    return NextResponse.json(
      {
        success: false,
        error: 'This trusted reviewer invitation is invalid or no longer active.',
        code: 'invalid_invitation',
      },
      { status: 400 }
    );
  }

  const ipKey = hashReviewerInviteToken(getClientIp(request)).slice(0, 24);
  const userKey = hashReviewerInviteToken(user.id).slice(0, 24);
  const limit = await rateLimit({
    key: `reviewer-invite:accept:${ipKey}:${userKey}`,
    limit: 10,
    window: 900,
  });
  if (!limit.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many invitation attempts. Try again later.',
        code: 'rate_limited',
      },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 60) } }
    );
  }

  let invitation;
  try {
    invitation = await resolveReviewerInvitation(token);
  } catch (error) {
    if (error instanceof ReviewerInvitationError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: 'Could not check this trusted reviewer invitation.',
        code: 'resolve_failed',
      },
      { status: 500 }
    );
  }

  if (invitation.status !== 'pending') {
    const expired = invitation.status === 'expired';
    return NextResponse.json(
      {
        success: false,
        error: expired
          ? 'This trusted reviewer invitation has expired.'
          : 'This trusted reviewer invitation is invalid or no longer active.',
        code: expired ? 'expired' : 'invalid_invitation',
      },
      { status: expired ? 410 : 409 }
    );
  }

  if (normalizeEmail(user.email) !== invitation.email) {
    return NextResponse.json(
      {
        success: false,
        error: 'Use the email address that received this invitation.',
        code: 'email_mismatch',
      },
      { status: 403 }
    );
  }

  const { data, error } = await supabase.rpc('accept_trusted_reviewer_invitation', {
    raw_token: token,
  });
  if (error) {
    const friendly = friendlyRpcError(error.message);
    console.warn('Trusted reviewer invitation acceptance rejected:', {
      code: error.code,
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
      {
        success: false,
        error: 'This trusted reviewer invitation could not be accepted.',
        code: 'acceptance_failed',
      },
      { status: 409 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Trusted reviewer access is active.',
    invitation: { status: result.invitation_status || 'accepted' },
    redirectTo: '/',
  });
}
