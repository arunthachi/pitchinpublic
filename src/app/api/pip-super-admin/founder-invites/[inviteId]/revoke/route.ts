import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePlatformAdmin } from '@/lib/admin';
import { founderInvitationErrorResponse, revokeFounderInvitation } from '@/lib/founder-invitations';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ inviteId: z.string().uuid() });

export async function POST(request: NextRequest, props: { params: Promise<{ inviteId: string }> }) {
  const admin = await requirePlatformAdmin(request);
  if (!admin.ok) return NextResponse.json({ success: false, error: admin.error }, { status: admin.status });

  const params = paramsSchema.safeParse(await props.params);
  if (!params.success) return NextResponse.json({ success: false, error: 'Invalid founder invitation.', code: 'invalid_id' }, { status: 400 });

  try {
    const result = await revokeFounderInvitation({
      supabase: admin.adminSupabase,
      actor: admin.user,
      request,
      invitationId: params.data.inviteId,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const response = founderInvitationErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
