import { NextRequest, NextResponse } from 'next/server';
import { createRequestSupabase } from '@/lib/admin';
import { INVITE_ONLY_MESSAGE, isUserAllowedForPilot } from '@/lib/pilot-access';

export async function GET(request: NextRequest) {
  const supabase = createRequestSupabase(request);

  if (!supabase) {
    return NextResponse.json(
      { success: false, allowed: false, error: 'Auth is not configured.' },
      { status: 503 }
    );
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { success: false, allowed: false, error: 'Authentication required.' },
      { status: 401 }
    );
  }

  const allowed = await isUserAllowedForPilot(user);

  if (!allowed) {
    return NextResponse.json(
      {
        success: false,
        allowed: false,
        error: INVITE_ONLY_MESSAGE,
        code: 'invite_required',
      },
      { status: 403 }
    );
  }

  return NextResponse.json({ success: true, allowed: true });
}
