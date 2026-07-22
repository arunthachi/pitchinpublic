import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePlatformAdmin } from '@/lib/admin';
import {
  createFounderInvitation,
  founderInvitationErrorResponse,
} from '@/lib/founder-invitations';

export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().trim().email().max(320),
  cohort: z.string().trim().max(120).optional().default(''),
  expiresInDays: z.number().int().min(1).max(90).default(30),
  sendEmail: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  const admin = await requirePlatformAdmin(request);
  if (!admin.ok) return NextResponse.json({ success: false, error: admin.error }, { status: admin.status });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Check the founder invite fields and try again.', code: 'invalid_input' }, { status: 400 });
  }

  try {
    const result = await createFounderInvitation({
      supabase: admin.adminSupabase,
      actor: admin.user,
      request,
      email: parsed.data.email,
      cohort: parsed.data.cohort,
      expiresInDays: parsed.data.expiresInDays,
      shouldSendEmail: parsed.data.sendEmail,
    });
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    const response = founderInvitationErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
