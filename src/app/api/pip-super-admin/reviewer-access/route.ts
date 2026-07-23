import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizeEmail, requirePlatformAdmin } from '@/lib/admin';

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

  // Revoke the membership first so a partial cleanup failure cannot leave
  // community pitch access active. Event grants are inert for revoked members.
  const { error: membershipError } = await admin.adminSupabase
    .from('trusted_reviewer_memberships')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      revoked_by: admin.user.id,
    })
    .eq('id', membership.id)
    .eq('status', 'active');

  if (membershipError) {
    return NextResponse.json({ success: false, error: 'Could not revoke reviewer access.' }, { status: 500 });
  }

  const { error: grantError } = await admin.adminSupabase
    .from('trusted_reviewer_event_access')
    .delete()
    .eq('membership_id', membership.id);
  if (grantError) {
    console.warn('Reviewer membership revoked but stale event grants could not be removed:', grantError);
  }

  return NextResponse.json({ success: true, reviewerEmail: email });
}
