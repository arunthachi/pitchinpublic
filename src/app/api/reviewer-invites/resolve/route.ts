import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, rateLimit } from '@/lib/ratelimit';
import {
  hashReviewerInviteToken,
  resolveReviewerInvitation,
  reviewerInvitationErrorResponse,
} from '@/lib/reviewer-invitations';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || '';
  const tokenKey = token ? hashReviewerInviteToken(token).slice(0, 24) : 'missing';
  const ipKey = hashReviewerInviteToken(getClientIp(request)).slice(0, 24);
  const limit = await rateLimit({
    key: `reviewer-invite:resolve:${ipKey}:${tokenKey}`,
    limit: 30,
    window: 900,
  });

  if (!limit.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many invitation checks. Try again later.',
        code: 'rate_limited',
      },
      {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': String(limit.retryAfter || 60),
        },
      }
    );
  }

  try {
    const invitation = await resolveReviewerInvitation(token);
    return NextResponse.json(
      { success: true, invitation },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    const response = reviewerInvitationErrorResponse(error);
    return NextResponse.json(response.body, {
      status: response.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
