import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { escapeHtml, sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const leadSchema = z.object({
  type: z.enum(['founder', 'organizer']),
  email: z.string().email().trim().toLowerCase(),
  name: z.string().trim().min(1).max(120),
  website: z.string().trim().max(240).optional().default(''),
  source: z.string().trim().max(180).optional().default('unknown'),
});

type LeadRequest = z.infer<typeof leadSchema>;
type DeliveryStatus = 'sent' | 'failed' | 'not_configured' | 'skipped';

function createSupabaseClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

async function safeSendEmail(params: Parameters<typeof sendEmail>[0]) {
  try {
    return await sendEmail(params);
  } catch (error) {
    return {
      ok: false as const,
      status: 'failed' as const,
      error: error instanceof Error ? error.message : 'Unknown email error.',
    };
  }
}

function requestKindLabel(type: LeadRequest['type']) {
  return type === 'founder' ? 'Founder access request' : 'Organizer invite request';
}

function requestRoleLabel(type: LeadRequest['type']) {
  return type === 'founder' ? 'Founder' : 'Organizer';
}

function buildConfirmationEmail(lead: LeadRequest) {
  const roleLabel = requestRoleLabel(lead.type);
  const title = lead.type === 'founder' ? 'Your founder request is in' : 'Your organizer request is in';
  const intro =
    lead.type === 'founder'
      ? 'We received your request for founder access and will follow up with the next step.'
      : 'We received your organizer invite request. Organizer access stays invite-only, and we will review your program before following up.';

  return {
    subject: `Pitch in Public: ${title}`,
    text: [
      `Thanks for requesting ${roleLabel.toLowerCase()} access on Pitch in Public.`,
      '',
      intro,
      '',
      lead.website ? `Website or LinkedIn: ${lead.website}` : 'Website or LinkedIn: not provided',
      '',
      'If you need to update your request, just reply to this email.',
    ].join('\n'),
    html: `
      <div style="font-family: Inter, Arial, sans-serif; background:#050608; color:#f8fafc; padding:24px;">
        <div style="max-width:640px; margin:0 auto; border:1px solid rgba(255,255,255,.14); border-radius:24px; padding:24px; background:#0f172a;">
          <p style="color:#22d3ee; font-size:12px; letter-spacing:.18em; text-transform:uppercase; font-weight:800;">Pitch in Public ${escapeHtml(roleLabel.toLowerCase())} request</p>
          <h1 style="margin:8px 0 16px; font-size:28px;">${escapeHtml(title)}</h1>
          <p style="line-height:1.7; color:#cbd5e1;">${escapeHtml(intro)}</p>
          <div style="margin-top:24px; padding:18px; border-radius:18px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08);">
            <p style="margin:0 0 8px; color:#94a3b8; font-size:13px; text-transform:uppercase; letter-spacing:.16em; font-weight:700;">Request details</p>
            <p style="margin:0; line-height:1.7; color:#f8fafc;"><strong>Email:</strong> ${escapeHtml(lead.email)}</p>
            <p style="margin:8px 0 0; line-height:1.7; color:#f8fafc;"><strong>${escapeHtml(roleLabel)} name:</strong> ${escapeHtml(lead.name)}</p>
            <p style="margin:8px 0 0; line-height:1.7; color:#f8fafc;"><strong>Website / LinkedIn:</strong> ${escapeHtml(lead.website || 'Not provided')}</p>
          </div>
          <p style="margin-top:24px; font-size:13px; color:#94a3b8;">If you need to update your request, reply to this email and we will handle it manually.</p>
        </div>
      </div>
    `,
  };
}

function buildAdminNotificationEmail(lead: LeadRequest, source: string, userAgent: string) {
  const title = requestKindLabel(lead.type);

  return {
    subject: `[Pitch in Public] ${title}: ${lead.name}`,
    text: [
      `${title} received.`,
      '',
      `Type: ${lead.type}`,
      `Email: ${lead.email}`,
      `${lead.type === 'founder' ? 'Startup' : 'Organization'}: ${lead.name}`,
      `Website / LinkedIn: ${lead.website || 'Not provided'}`,
      `Source: ${source}`,
      `User agent: ${userAgent}`,
      `Submitted at: ${new Date().toISOString()}`,
    ].join('\n'),
    html: `
      <div style="font-family: Inter, Arial, sans-serif; background:#050608; color:#f8fafc; padding:24px;">
        <div style="max-width:640px; margin:0 auto; border:1px solid rgba(255,255,255,.14); border-radius:24px; padding:24px; background:#0f172a;">
          <p style="color:#22d3ee; font-size:12px; letter-spacing:.18em; text-transform:uppercase; font-weight:800;">Pitch in Public lead</p>
          <h1 style="margin:8px 0 20px; font-size:28px;">${escapeHtml(title)}</h1>
          <table style="width:100%; border-collapse:collapse;">
            <tr>
              <td style="width:32%; padding:12px; border-top:1px solid rgba(255,255,255,.1); color:#94a3b8; font-weight:700;">Type</td>
              <td style="padding:12px; border-top:1px solid rgba(255,255,255,.1); color:#f8fafc;">${escapeHtml(lead.type)}</td>
            </tr>
            <tr>
              <td style="width:32%; padding:12px; border-top:1px solid rgba(255,255,255,.1); color:#94a3b8; font-weight:700;">Email</td>
              <td style="padding:12px; border-top:1px solid rgba(255,255,255,.1); color:#f8fafc;">${escapeHtml(lead.email)}</td>
            </tr>
            <tr>
              <td style="width:32%; padding:12px; border-top:1px solid rgba(255,255,255,.1); color:#94a3b8; font-weight:700;">${escapeHtml(lead.type === 'founder' ? 'Startup' : 'Organization')}</td>
              <td style="padding:12px; border-top:1px solid rgba(255,255,255,.1); color:#f8fafc;">${escapeHtml(lead.name)}</td>
            </tr>
            <tr>
              <td style="width:32%; padding:12px; border-top:1px solid rgba(255,255,255,.1); color:#94a3b8; font-weight:700;">Website / LinkedIn</td>
              <td style="padding:12px; border-top:1px solid rgba(255,255,255,.1); color:#f8fafc;">${escapeHtml(lead.website || 'Not provided')}</td>
            </tr>
            <tr>
              <td style="width:32%; padding:12px; border-top:1px solid rgba(255,255,255,.1); color:#94a3b8; font-weight:700;">Source</td>
              <td style="padding:12px; border-top:1px solid rgba(255,255,255,.1); color:#f8fafc;">${escapeHtml(source)}</td>
            </tr>
            <tr>
              <td style="width:32%; padding:12px; border-top:1px solid rgba(255,255,255,.1); color:#94a3b8; font-weight:700;">User agent</td>
              <td style="padding:12px; border-top:1px solid rgba(255,255,255,.1); color:#f8fafc;">${escapeHtml(userAgent)}</td>
            </tr>
          </table>
        </div>
      </div>
    `,
  };
}

function leadSuccessMessage(confirmationStatus: DeliveryStatus, notificationStatus: DeliveryStatus, type: LeadRequest['type']) {
  if (confirmationStatus === 'sent' && notificationStatus === 'sent') {
    return type === 'founder'
      ? 'Request received. Check your inbox for the next step.'
      : 'Request received. Check your inbox for the next step.';
  }

  return type === 'founder'
    ? 'Request received. We saved it and will follow up manually if email delivery needs attention.'
    : 'Request received. We saved it and will follow up manually if email delivery needs attention.';
}

function leadWarning(confirmationStatus: DeliveryStatus, notificationStatus: DeliveryStatus) {
  const issues: string[] = [];

  if (confirmationStatus !== 'sent') {
    issues.push(
      confirmationStatus === 'not_configured'
        ? 'We could not send the confirmation email because email is not configured here.'
        : 'We could not send the confirmation email automatically.'
    );
  }

  if (notificationStatus !== 'sent') {
    issues.push(
      notificationStatus === 'not_configured'
        ? 'We could not notify the team automatically because email is not configured here.'
        : 'We could not notify the team automatically.'
    );
  }

  return issues.join(' ');
}

async function persistLeadDeliveryState(
  supabase: ReturnType<typeof createSupabaseClient>,
  leadRequestId: string,
  confirmationStatus: DeliveryStatus,
  confirmationError: string | null,
  notificationStatus: DeliveryStatus,
  notificationError: string | null
) {
  if (!supabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const { error } = await supabase
    .from('lead_requests')
    .update({
      confirmation_status: confirmationStatus,
      confirmation_error: confirmationError ? confirmationError.slice(0, 1000) : null,
      confirmation_sent_at: confirmationStatus === 'sent' ? new Date().toISOString() : null,
      notification_status: notificationStatus,
      notification_error: notificationError ? notificationError.slice(0, 1000) : null,
      notification_sent_at: notificationStatus === 'sent' ? new Date().toISOString() : null,
    })
    .eq('id', leadRequestId);

  if (error) {
    console.error('Lead request delivery status update failed:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = leadSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Check the form fields and try again.' }, { status: 400 });
    }

    const lead = parsed.data;
    const source = (lead.source || request.headers.get('referer') || request.nextUrl.pathname || 'unknown')
      .trim()
      .slice(0, 180);
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const supabase = createSupabaseClient();
    const leadRequestId = randomUUID();

    if (!supabase) {
      console.error('Lead request storage is not configured. Missing Supabase env.');
      return NextResponse.json(
        { success: false, error: 'We could not save your request right now. Please email hello@pitchinpublic.io.' },
        { status: 503 }
      );
    }

    const { error: insertError } = await supabase.from('lead_requests').insert({
      id: leadRequestId,
      type: lead.type,
      email: lead.email,
      name: lead.name,
      website: lead.website || null,
      source,
      user_agent: userAgent,
      status: 'new',
      notification_status: 'pending',
      confirmation_status: 'pending',
    });

    if (insertError) {
      console.error('Lead request storage failed:', insertError);
      return NextResponse.json(
        { success: false, error: 'We could not save your request right now. Please email hello@pitchinpublic.io.' },
        { status: 500 }
      );
    }

    const confirmationEmail = buildConfirmationEmail(lead);
    const notificationEmail = buildAdminNotificationEmail(lead, source, userAgent);
    const recipients = (process.env.LEAD_EMAIL_TO || 'hello@pitchinpublic.io,arun@pitchinpublic.io')
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);

    const [confirmationResult, notificationResult] = await Promise.all([
      safeSendEmail({
        to: lead.email,
        subject: confirmationEmail.subject,
        text: confirmationEmail.text,
        html: confirmationEmail.html,
      }),
      recipients.length
        ? safeSendEmail({
            to: recipients,
            replyTo: lead.email,
            subject: notificationEmail.subject,
            text: notificationEmail.text,
            html: notificationEmail.html,
          })
        : Promise.resolve({ ok: true as const, status: 'skipped' as const, error: null }),
    ]);

    const confirmationStatus = confirmationResult.status;
    const notificationStatus = notificationResult.status;
    const confirmationError = confirmationResult.ok ? null : confirmationResult.error;
    const notificationError = notificationResult.ok ? null : notificationResult.error;

    await persistLeadDeliveryState(
      supabase,
      leadRequestId,
      confirmationStatus,
      confirmationError,
      notificationStatus,
      notificationError
    );

    const warning = leadWarning(confirmationStatus, notificationStatus);

    return NextResponse.json(
      {
        success: true,
        lead: {
          id: leadRequestId,
          type: lead.type,
          email: lead.email,
          name: lead.name,
          website: lead.website || null,
          source,
          status: 'new',
        },
        confirmationStatus,
        notificationStatus,
        message: leadSuccessMessage(confirmationStatus, notificationStatus, lead.type),
        warning: warning || null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Lead capture failed:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please email hello@pitchinpublic.io.' },
      { status: 500 }
    );
  }
}
