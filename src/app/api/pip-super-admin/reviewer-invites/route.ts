import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePlatformAdmin } from '@/lib/admin';
import {
  createReviewerInvitation,
  listReviewerInvitations,
  listTrustedReviewers,
  reviewerInvitationErrorResponse,
} from '@/lib/reviewer-invitations';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  email: z.string().trim().email().max(320),
  reviewerRoles: z.array(z.enum([
    'investor', 'product_leader', 'past_judge', 'mentor', 'operator', 'other',
  ])).min(1).max(6),
  expertise: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  title: z.string().trim().max(120).optional().default(''),
  organization: z.string().trim().max(160).optional().default(''),
  expiresInDays: z.number().int().min(1).max(90).default(30),
  sendEmail: z.boolean().default(true),
});

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export async function GET(request: NextRequest) {
  const admin = await requirePlatformAdmin(request);
  if (!admin.ok) {
    return NextResponse.json(
      { success: false, error: admin.error },
      { status: admin.status }
    );
  }

  const parsed = listSchema.safeParse({ limit: request.nextUrl.searchParams.get('limit') || 50 });
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Use a valid invitation limit.', code: 'invalid_input' },
      { status: 400 }
    );
  }

  try {
    const [invitations, reviewers] = await Promise.all([
      listReviewerInvitations(admin.adminSupabase, parsed.data.limit),
      listTrustedReviewers(admin.adminSupabase),
    ]);
    return NextResponse.json({ success: true, invitations, reviewers });
  } catch (error) {
    const response = reviewerInvitationErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(request: NextRequest) {
  const admin = await requirePlatformAdmin(request);
  if (!admin.ok) {
    return NextResponse.json(
      { success: false, error: admin.error },
      { status: admin.status }
    );
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Check the trusted reviewer invite fields and try again.',
        code: 'invalid_input',
      },
      { status: 400 }
    );
  }

  try {
    const result = await createReviewerInvitation({
      supabase: admin.adminSupabase,
      actor: admin.user,
      request,
      email: parsed.data.email,
      reviewerRoles: parsed.data.reviewerRoles,
      expertise: parsed.data.expertise,
      title: parsed.data.title,
      organization: parsed.data.organization,
      expiresInDays: parsed.data.expiresInDays,
      shouldSendEmail: parsed.data.sendEmail,
    });
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    const response = reviewerInvitationErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
