import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizeEmail, requirePlatformAdmin } from '@/lib/admin';
import { escapeHtml, sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const createOrganizerInviteSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  organizationName: z.string().trim().min(2).max(160),
  website: z.string().trim().max(240).optional().default(''),
  expiresInDays: z.number().int().min(1).max(90).default(30),
  sendEmail: z.boolean().default(true),
});

function createInviteCode() {
  return `org-${randomBytes(9).toString('base64url').toLowerCase()}`;
}

export async function POST(request: NextRequest) {
  const admin = await requirePlatformAdmin(request);

  if (!admin.ok) {
    return NextResponse.json({ success: false, error: admin.error }, { status: admin.status });
  }

  const parsed = createOrganizerInviteSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Check the organizer invite fields and try again.' }, { status: 400 });
  }

  const payload = parsed.data;
  const inviteCode = createInviteCode();
  const expiresAt = new Date(Date.now() + payload.expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: invitation, error } = await admin.adminSupabase
    .from('organizer_invitations')
    .insert({
      email: normalizeEmail(payload.email),
      organization_name: payload.organizationName,
      website: payload.website || null,
      invite_code: inviteCode,
      invited_by: admin.user.id,
      expires_at: expiresAt,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) {
    console.error('Organizer invitation creation failed:', error);
    return NextResponse.json({ success: false, error: 'Could not create organizer invite.' }, { status: 500 });
  }

  const inviteUrl = `${request.nextUrl.origin}/organizer/invite?code=${encodeURIComponent(inviteCode)}`;
  let emailStatus: 'skipped' | 'sent' | 'failed' | 'not_configured' = payload.sendEmail ? 'failed' : 'skipped';
  let emailError: string | null = null;

  if (payload.sendEmail) {
    const emailResult = await sendEmail({
      to: payload.email,
      replyTo: admin.user.email || undefined,
      subject: 'Your Pitch in Public organizer invite',
      text: [
        `You have been invited to create organizer rooms on Pitch in Public for ${payload.organizationName}.`,
        '',
        `Accept your invite: ${inviteUrl}`,
        '',
        'This invite is tied to your email and expires soon.',
      ].join('\n'),
      html: `
        <div style="font-family: Inter, Arial, sans-serif; background:#050608; color:#f8fafc; padding:24px;">
          <div style="max-width:640px; margin:0 auto; border:1px solid rgba(255,255,255,.14); border-radius:24px; padding:24px; background:#0f172a;">
            <p style="color:#22d3ee; font-size:12px; letter-spacing:.18em; text-transform:uppercase; font-weight:800;">Pitch in Public organizer invite</p>
            <h1 style="margin:8px 0 16px; font-size:28px;">Create pitch rooms for ${escapeHtml(payload.organizationName)}</h1>
            <p style="line-height:1.7; color:#cbd5e1;">You can create events, invite founders, coaches, mentors, and judges, then review pitch submissions from one dashboard.</p>
            <p style="margin:28px 0;">
              <a href="${escapeHtml(inviteUrl)}" style="display:inline-block; padding:14px 22px; border-radius:999px; background:#22d3ee; color:#020617; font-weight:900; text-decoration:none;">Accept organizer invite</a>
            </p>
            <p style="font-size:13px; color:#94a3b8;">If the button does not work, open this link: ${escapeHtml(inviteUrl)}</p>
          </div>
        </div>
      `,
    });

    emailStatus = emailResult.status;
    emailError = emailResult.ok ? null : emailResult.error;
  }

  const emailSentAt = emailStatus === 'sent' ? new Date().toISOString() : null;
  const { data: updatedInvitation, error: updateError } = await admin.adminSupabase
    .from('organizer_invitations')
    .update({
      email_status: emailStatus,
      email_error: emailError,
      email_sent_at: emailSentAt,
    })
    .eq('id', invitation.id)
    .select('*')
    .single();

  if (updateError) {
    console.error('Organizer invitation email status update failed:', updateError);
  }

  return NextResponse.json(
    {
      success: true,
      invitation: updatedInvitation || invitation,
      inviteUrl,
      emailStatus,
      emailError,
    },
    { status: 201 }
  );
}
