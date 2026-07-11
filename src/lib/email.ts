export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeEmailFrom(value?: string) {
  const fallback = 'Pitch in Public <onboarding@resend.dev>';
  const trimmed = (value || fallback).trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
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
    return { ok: false as const, status: 'failed' as const, error: await response.text() };
  }

  return { ok: true as const, status: 'sent' as const };
}
