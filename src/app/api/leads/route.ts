import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { readableEmailError } from '@/lib/email-errors';

export const dynamic = 'force-dynamic';

const leadSchema = z.object({
  type: z.enum(['founder', 'organizer']),
  email: z.string().email().trim().toLowerCase(),
  name: z.string().trim().min(1).max(120),
  website: z.string().trim().max(240).optional().default(''),
  source: z.string().trim().max(180).optional().default('unknown'),
});

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function normalizeEmailFrom(value?: string) {
  const fallback = 'Pitch in Public <onboarding@resend.dev>';
  const trimmed = (value || fallback).trim();
  const unquoted = (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  )
    ? trimmed.slice(1, -1).trim()
    : trimmed;

  if (!unquoted.includes('@')) return fallback;
  if (unquoted.includes('<') && unquoted.includes('>')) return unquoted;
  if (!/\s/.test(unquoted)) return unquoted;

  const email = unquoted.match(EMAIL_PATTERN)?.[0];
  return email ? `Pitch in Public <${email}>` : fallback;
}

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

async function updateLeadNotificationStatus(
  supabase: ReturnType<typeof createSupabaseClient>,
  leadRequestId: string | null,
  status: 'sent' | 'failed' | 'not_configured',
  error?: string
) {
  if (!supabase || !leadRequestId || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const { error: updateError } = await supabase
    .from('lead_requests')
    .update({
      notification_status: status,
      notification_error: error ? error.slice(0, 1000) : null,
    })
    .eq('id', leadRequestId);

  if (updateError) {
    console.error('Lead request notification status update failed:', updateError);
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = leadSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: 'Check the form fields and try again.' }, { status: 400 });
    }

    const lead = parsed.data;
    const source = `${request.headers.get('origin') || ''}${lead.source}`;
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const supabase = createSupabaseClient();
    const leadRequestId = randomUUID();
    let leadStored = false;

    if (supabase) {
      const { error } = await supabase
        .from('lead_requests')
        .insert({
          id: leadRequestId,
          type: lead.type,
          email: lead.email,
          name: lead.name,
          website: lead.website || null,
          source,
          user_agent: userAgent,
          notification_status: 'pending',
        });

      if (error) {
        console.error('Lead request storage failed:', error);
      } else {
        leadStored = true;
      }
    } else {
      console.error('Lead request storage is not configured. Missing Supabase env.');
    }

    const recipients = (process.env.LEAD_EMAIL_TO || 'hello@pitchinpublic.io,arun@pitchinpublic.io')
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);
    const from = normalizeEmailFrom(process.env.LEAD_EMAIL_FROM);
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      console.error('Lead capture email is not configured. Missing RESEND_API_KEY.', lead);
      if (leadStored) {
        await updateLeadNotificationStatus(supabase, leadRequestId, 'not_configured');
      }
      return NextResponse.json({ error: 'We could not send this request. Please email hello@pitchinpublic.io.' }, { status: 503 });
    }

    const subject = `[Pitch in Public] ${lead.type === 'founder' ? 'Founder invite request' : 'Organizer access request'}: ${lead.name}`;
    const rows = [
      ['Type', lead.type],
      ['Email', lead.email],
      [lead.type === 'founder' ? 'Startup' : 'Organization', lead.name],
      ['Website / LinkedIn', lead.website || 'Not provided'],
      ['Source', source],
      ['User agent', userAgent],
      ['Submitted at', new Date().toISOString()],
    ];
    const text = rows.map(([label, value]) => `${label}: ${value}`).join('\n');
    const html = `
      <div style="font-family: Inter, Arial, sans-serif; background:#050608; color:#f8fafc; padding:24px;">
        <div style="max-width:640px; margin:0 auto; border:1px solid rgba(255,255,255,.14); border-radius:24px; padding:24px; background:#0f172a;">
          <p style="color:#22d3ee; font-size:12px; letter-spacing:.18em; text-transform:uppercase; font-weight:800;">Pitch in Public lead</p>
          <h1 style="margin:8px 0 20px; font-size:28px;">${escapeHtml(lead.type === 'founder' ? 'Founder invite request' : 'Organizer access request')}</h1>
          <table style="width:100%; border-collapse:collapse;">
            ${rows
              .map(
                ([label, value]) => `
                  <tr>
                    <td style="width:32%; padding:12px; border-top:1px solid rgba(255,255,255,.1); color:#94a3b8; font-weight:700;">${escapeHtml(label)}</td>
                    <td style="padding:12px; border-top:1px solid rgba(255,255,255,.1); color:#f8fafc;">${escapeHtml(value)}</td>
                  </tr>
                `
              )
              .join('')}
          </table>
        </div>
      </div>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: recipients,
        reply_to: lead.email,
        subject,
        text,
        html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const readableError = readableEmailError(errorText);
      console.error('Lead capture email failed:', readableError);
      if (leadStored) {
        await updateLeadNotificationStatus(supabase, leadRequestId, 'failed', readableError);
      }
      return NextResponse.json({ error: 'We could not send this request. Please email hello@pitchinpublic.io.' }, { status: 502 });
    }

    await updateLeadNotificationStatus(supabase, leadRequestId, 'sent');

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Lead capture failed:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please email hello@pitchinpublic.io.' },
      { status: 500 }
    );
  }
}
