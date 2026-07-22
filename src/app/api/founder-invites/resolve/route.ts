import { NextRequest, NextResponse } from 'next/server';
import {
  FounderInviteResolveError,
  resolveFounderInviteToken,
} from '@/app/api/founder-invites/_server';
import { getClientIp, rateLimit } from '@/lib/ratelimit';
import { hashFounderInviteToken } from '@/lib/founder-invitations';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token') || '';
    const tokenKey = token
      ? hashFounderInviteToken(token).slice(0, 24)
      : 'missing';
    const ipKey = hashFounderInviteToken(getClientIp(request)).slice(0, 24);
    const limit = await rateLimit({
      key: `founder-invite:resolve:${ipKey}:${tokenKey}`,
      limit: 30,
      window: 900,
    });

    if (!limit.success) {
      return NextResponse.json(
        { success: false, error: 'Too many invitation checks. Try again later.', code: 'rate_limited' },
        { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(limit.retryAfter || 60) } }
      );
    }
    const invitation = await resolveFounderInviteToken(token);

    return NextResponse.json(
      { success: true, invitation },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (error instanceof FounderInviteResolveError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    console.error('Founder invitation resolve endpoint failed');
    return NextResponse.json(
      { success: false, error: 'Could not check this founder invitation.', code: 'resolve_failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
