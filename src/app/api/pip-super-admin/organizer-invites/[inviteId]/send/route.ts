import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePlatformAdmin } from '@/lib/admin';
import { escapeHtml, sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  inviteId: z.string().uuid(),
});

function inviteEmailContent({
  organizationName,
  inviteUrl,
}: {
  organizationName: string;
  inviteUrl: string;
}) {
  return {
    subject: `Your organizer access is approved for ${organizationName}`,
    text: [
      `Your Pitch in Public organizer access is approved for ${organizationName}.`,
      '',
      'Next steps:',
      '1. Open the invitation link below.',
      '2. Sign in or create an account with this invited email address.',
      '3. Accept the invitation, create your first event, and invite founders or teammates.',
      '',
      `Accept organizer invitation: ${inviteUrl}`,
      '',
      'This private invitation works only with the email address that received it and expires soon.',
    ].join('\n'),
    html: `
      <div style="font-family: Inter, Arial, sans-serif; background:#050608; color:#f8fafc; padding:24px;">
        <div style="max-width:640px; margin:0 auto; border:1px solid rgba(255,255,255,.14); border-radius:24px; padding:24px; background:#0f172a;">
          <p style="color:#22d3ee; font-size:12px; letter-spacing:.18em; text-transform:uppercase; font-weight:800;">Organizer access approved</p>
          <h1 style="margin:8px 0 16px; font-size:28px;">You are invited to organize ${escapeHtml(organizationName)} on Pitch in Public</h1>
          <p style="line-height:1.7; color:#cbd5e1;">You can create events, invite founders, coaches, mentors, and judges, then review pitch submissions from one dashboard.</p>
          <div style="margin-top:20px; padding:18px; border-radius:18px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08);">
            <p style="margin:0 0 10px; color:#f8fafc; font-weight:800;">What to do next</p>
            <p style="margin:0; line-height:1.8; color:#cbd5e1;">1. Open the invitation below.<br>2. Sign in or create an account with this invited email.<br>3. Accept access and create your first event.</p>
          </div>
          <p style="margin:28px 0;">
            <a href="${escapeHtml(inviteUrl)}" style="display:inline-block; padding:14px 22px; border-radius:999px; background:#22d3ee; color:#020617; font-weight:900; text-decoration:none;">Accept organizer invitation</a>
          </p>
          <p style="font-size:13px; color:#94a3b8;">This private invitation works only with the email address that received it. If the button does not work, copy this link into your browser: ${escapeHtml(inviteUrl)}</p>
        </div>
      </div>
    `,
  };
}

export async function POST(request: NextRequest, props: { params: Promise<{ inviteId: string }> }) {
  const admin = await requirePlatformAdmin(request);

  if (!admin.ok) {
    return NextResponse.json({ success: false, error: admin.error }, { status: admin.status });
  }

  const params = paramsSchema.safeParse(await props.params);

  if (!params.success) {
    return NextResponse.json({ success: false, error: 'Invalid organizer invite.' }, { status: 400 });
  }

  const { data: invitation, error: inviteError } = await admin.adminSupabase
    .from('organizer_invitations')
    .select('id,email,organization_name,invite_code,status,expires_at')
    .eq('id', params.data.inviteId)
    .single();

  if (inviteError || !invitation) {
    return NextResponse.json({ success: false, error: 'Organizer invite was not found.' }, { status: 404 });
  }

  if (invitation.status !== 'pending') {
    return NextResponse.json({ success: false, error: 'Only pending organizer invites can be emailed.' }, { status: 400 });
  }

  if (invitation.expires_at && new Date(invitation.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ success: false, error: 'This organizer invite has expired.' }, { status: 400 });
  }

  const inviteUrl = `${request.nextUrl.origin}/organizer/invite?code=${encodeURIComponent(invitation.invite_code)}`;
  const emailContent = inviteEmailContent({
    organizationName: invitation.organization_name || 'your organization',
    inviteUrl,
  });

  const emailResult = await sendEmail({
    to: invitation.email,
    replyTo: admin.user.email || undefined,
    ...emailContent,
  });

  const emailStatus = emailResult.status;
  const emailError = emailResult.ok ? null : emailResult.error;
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
    console.error('Organizer invitation resend status update failed:', updateError);
  }

  return NextResponse.json({
    success: true,
    invitation: updatedInvitation || invitation,
    inviteUrl,
    emailStatus,
    emailError,
  });
}
