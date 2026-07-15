import { readableEmailError } from './email-errors';
import { formatPitchLength } from './duration';

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const VERIFIED_SENDER = 'Pitch in Public <hello@mail.pitchinpublic.io>';

export const INVITE_EMAIL_STATUSES = ['unknown', 'skipped', 'sent', 'failed', 'not_configured'] as const;
export type InviteEmailStatus = (typeof INVITE_EMAIL_STATUSES)[number];

const INVITE_EMAIL_STATUS_LABELS: Record<InviteEmailStatus, string> = {
  unknown: 'Pending',
  skipped: 'Skipped',
  sent: 'Sent',
  failed: 'Failed',
  not_configured: 'Not configured',
};

export function inviteEmailStatusLabel(status?: string | null) {
  if (!status) return INVITE_EMAIL_STATUS_LABELS.unknown;
  if (status in INVITE_EMAIL_STATUS_LABELS) {
    return INVITE_EMAIL_STATUS_LABELS[status as InviteEmailStatus];
  }
  return INVITE_EMAIL_STATUS_LABELS.unknown;
}

export function inviteEmailStatusTone(status?: string | null) {
  switch (status) {
    case 'sent':
      return 'bg-neon-lime/15 text-neon-lime';
    case 'failed':
      return 'bg-roast/15 text-roast';
    case 'not_configured':
      return 'bg-amber-400/15 text-amber-300';
    case 'skipped':
      return 'bg-white/10 text-slate-300';
    default:
      return 'bg-neon-cyan/15 text-neon-cyan';
  }
}

export function buildEventInviteEmail({
  eventName,
  inviteUrl,
  pitchLengthSeconds,
  submissionDeadline,
  role = 'founder',
  eventDescription,
}: {
  eventName: string;
  inviteUrl: string;
  pitchLengthSeconds?: number | null;
  submissionDeadline?: string | null;
  role?: string;
  eventDescription?: string | null;
}) {
  const pitchLengthLabel = formatPitchLength(pitchLengthSeconds);
  const deadlineLabel = submissionDeadline
    ? new Date(submissionDeadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const isTeamInvite = ['organizer', 'admin', 'coach', 'mentor', 'judge'].includes(role);
  const introLine = isTeamInvite
    ? `You were invited to help with ${eventName} on Pitch in Public.`
    : `You were invited to join ${eventName} on Pitch in Public.`;
  const nextLine = isTeamInvite
    ? deadlineLabel
      ? `Sign in or create an account with this email, then open the event dashboard before ${deadlineLabel}.`
      : 'Sign in or create an account with this email, then open the event dashboard to review submissions.'
    : deadlineLabel
      ? `Sign in or create an account with this email, then submit your pitch before ${deadlineLabel}.`
      : 'Sign in or create an account with this email, then submit your pitch when you are ready.';
  const supportLine = isTeamInvite
    ? 'Once you are in, you can review submissions and help the room improve.'
    : 'Once you are in, record or upload a pitch and use the invite to join the room.';

  return {
    subject: `Join ${eventName} on Pitch in Public`,
    text: [
      introLine,
      '',
      `Open your invite: ${inviteUrl}`,
      '',
      nextLine,
      `Pitch length: ${pitchLengthLabel}.`,
      supportLine,
      ...(eventDescription ? ['', `Event context: ${eventDescription}`] : []),
    ].join('\n'),
    html: `
      <div style="font-family: Inter, Arial, sans-serif; background:#050608; color:#f8fafc; padding:24px;">
        <div style="max-width:680px; margin:0 auto; border:1px solid rgba(255,255,255,.14); border-radius:24px; padding:24px; background:#0f172a;">
          <p style="color:#22d3ee; font-size:12px; letter-spacing:.18em; text-transform:uppercase; font-weight:800;">Pitch in Public event invite</p>
          <h1 style="margin:8px 0 12px; font-size:30px;">${escapeHtml(eventName)}</h1>
          <p style="margin:0 0 16px; line-height:1.7; color:#cbd5e1;">${escapeHtml(introLine)}</p>
          <p style="margin:0 0 18px; line-height:1.7; color:#cbd5e1;">${escapeHtml(nextLine)}</p>
          <div style="margin:24px 0; border-radius:20px; padding:20px; background:rgba(34,211,238,.08); border:1px solid rgba(34,211,238,.18);">
            <p style="margin:0 0 8px; font-size:12px; letter-spacing:.16em; text-transform:uppercase; font-weight:800; color:#67e8f9;">Invite link</p>
            <p style="margin:0; line-height:1.7; color:#e2e8f0; word-break:break-word;">${escapeHtml(inviteUrl)}</p>
          </div>
          <div style="border-radius:20px; padding:20px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08);">
            <p style="margin:0 0 8px; font-size:12px; letter-spacing:.16em; text-transform:uppercase; font-weight:800; color:#cbd5e1;">Pitch details</p>
            <p style="margin:0; line-height:1.7; color:#f8fafc;">Pitch length: ${escapeHtml(pitchLengthLabel)}.</p>
            <p style="margin:10px 0 0; line-height:1.7; color:#cbd5e1;">${escapeHtml(supportLine)}</p>
            ${deadlineLabel ? `<p style="margin:10px 0 0; line-height:1.7; color:#cbd5e1;">Deadline: ${escapeHtml(deadlineLabel)}.</p>` : ''}
            ${eventDescription ? `<p style="margin:10px 0 0; line-height:1.7; color:#94a3b8;">${escapeHtml(eventDescription)}</p>` : ''}
          </div>
        </div>
      </div>
    `,
  };
}

export function normalizeEmailFrom(value?: string) {
  const fallback = VERIFIED_SENDER;
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
      from: VERIFIED_SENDER,
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
