import { createClient } from '@/lib/supabase/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isUserAllowedForPilot } from '@/lib/pilot-access';
import {
  FounderInviteResolveError,
  getFounderInviteTokenFromNextPath,
  resolveFounderInviteToken,
} from '@/app/api/founder-invites/_server';

async function isValidFounderInviteReturn(nextPath: string) {
  const token = getFounderInviteTokenFromNextPath(nextPath);
  if (!token) return false;

  try {
    const invitation = await resolveFounderInviteToken(token);
    return invitation.status === 'pending' || invitation.status === 'accepted';
  } catch (error) {
    if (!(error instanceof FounderInviteResolveError)) {
      console.error('Founder invitation auth return validation failed');
    }
    return false;
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null;
  const next = requestUrl.searchParams.get('next');
  const origin = requestUrl.origin;
  const supabase = await createClient();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else if (tokenHash && type) {
    await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
  }

  const safeNext = next && next.startsWith('/') && !next.startsWith('//')
    ? next
    : '/';

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // A valid founder invite may complete authentication so the acceptance page
    // can enforce the invited email. It does not grant app access by itself.
    const isAllowed = await isValidFounderInviteReturn(safeNext)
      || await isUserAllowedForPilot(user, safeNext);
    if (!isAllowed) {
      await supabase.auth.signOut();
      const blockedUrl = new URL('/', origin);
      blockedUrl.searchParams.set('auth', 'invite_required');
      blockedUrl.searchParams.set('next', safeNext);
      return NextResponse.redirect(blockedUrl);
    }
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
