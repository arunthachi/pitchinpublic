import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRequestSupabase, normalizeEmail, requirePlatformAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const revokeSchema = z.object({
  reviewerEmail: z.string().trim().email().max(320),
});

export async function DELETE(request: NextRequest) {
  const admin = await requirePlatformAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ success: false, error: admin.error }, { status: admin.status });
  }

  const parsed = revokeSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Choose a valid reviewer.' }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.reviewerEmail);
  const { data: profile } = await admin.adminSupabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ success: false, error: 'Reviewer account was not found.' }, { status: 404 });
  }

  const { data: membership } = await admin.adminSupabase
    .from('trusted_reviewer_memberships')
    .select('id')
    .eq('user_id', profile.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ success: false, error: 'Reviewer access is already inactive.' }, { status: 409 });
  }

  const requestSupabase = createRequestSupabase(request);
  const { error: membershipError } = await requestSupabase!.rpc(
    'revoke_trusted_reviewer_membership_locked',
    { target_membership_id: membership.id },
  );

  if (membershipError) {
    return NextResponse.json({ success: false, error: 'Could not revoke reviewer access.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, reviewerEmail: email });
}
