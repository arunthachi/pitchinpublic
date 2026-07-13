import { readableEmailError } from './email-errors';

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export function normalizeEmailFrom(value?: string) {
  const fallback = 'Pitch in Public <onboarding@resend.dev>';
  const trimmed = (value || fallback).trim();

  const unquoted = (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  )
    ? trimmed.slice(1, -1).trim()
    : trimmed;

  if (!unquoted.includes('@')) {
    return fallback;
  }

  if (unquoted.includes('<') && unquoted.includes('>')) {
    const email = unquoted.match(EMAIL_PATTERN)?.[0];
    if (!email) return fallback;

    const displayName = unquoted
      .slice(0, unquoted.indexOf('<'))
      .trim()
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ');

    return displayName ? `${displayName} <${email}>` : email;
  }

  if (!/\s/.test(unquoted)) {
    return unquoted;
  }

  const email = unquoted.match(EMAIL_PATTERN)?.[0];
  return email ? `Pitch in Public <${email}>` : fallback;
}

export async function sendEmail({
  to,
  replyTo,
  subject,
  text,
  html,
}: {
  to: string | string[];
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    return { ok: false as const, status: 'not_configured' as const, error: 'Missing RESEND_API_KEY.' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: normalizeEmailFrom(process.env.LEAD_EMAIL_FROM),
      to,
      reply_to: replyTo,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return { ok: false as const, status: 'failed' as const, error: readableEmailError(error) };
  }

  return { ok: true as const, status: 'sent' as const };
}
