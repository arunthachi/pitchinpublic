import { NextRequest, NextResponse } from 'next/server';
import { createRequestSupabase, createServiceSupabase } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestSupabase = createRequestSupabase(request);
  if (!requestSupabase) {
    return NextResponse.json(
      { success: false, allowed: false, error: 'Reviewer access is not configured.' },
      { status: 503 }
    );
  }

  const {
    data: { user },
    error: authError,
  } = await requestSupabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, allowed: false, error: 'Authentication required.' },
      { status: 401 }
    );
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { success: false, allowed: false, error: 'Reviewer access is not configured.' },
      { status: 503 }
    );
  }

  const { data: membership, error: membershipError } = await supabase
    .from('trusted_reviewer_memberships')
    .select('status,reviewer_roles,expertise,title,organization,created_at,id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError) {
    console.error('Trusted reviewer membership lookup failed:', {
      code: membershipError.code,
    });
    return NextResponse.json(
      { success: false, allowed: false, error: 'Could not verify reviewer access.' },
      { status: 500 }
    );
  }
  if (!membership) {
    return NextResponse.json(
      {
        success: false,
        allowed: false,
        error: 'Trusted reviewer access required.',
        code: 'reviewer_access_required',
      },
      { status: 403 }
    );
  }

  const [{ data: eventAccess, error: eventAccessError }, { data: founderMembership, error: founderMembershipError }] = await Promise.all([
    supabase
      .from('trusted_reviewer_event_access')
      .select('event_id')
      .eq('membership_id', membership.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('pilot_members')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  if (eventAccessError) {
    console.error('Trusted reviewer event access lookup failed:', {
      code: eventAccessError.code,
    });
    return NextResponse.json(
      { success: false, allowed: false, error: 'Could not load reviewer event access.' },
      { status: 500 }
    );
  }
  if (founderMembershipError && founderMembershipError.code !== '42P01') {
    console.warn('Reviewer access loaded without founder mode status:', {
      code: founderMembershipError.code,
    });
  }

  return NextResponse.json({
    success: true,
    allowed: true,
    membership: {
      status: membership.status,
      reviewerRoles: membership.reviewer_roles,
      expertise: membership.expertise,
      title: membership.title,
      organization: membership.organization,
      createdAt: membership.created_at,
    },
    founderAccess: Boolean(founderMembership),
    eventCount: (eventAccess || []).length,
  });
}
