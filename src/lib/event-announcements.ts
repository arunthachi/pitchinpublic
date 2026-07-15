import { escapeHtml } from '@/lib/email';
import { getPracticePrompt, nudgeCopy } from '@/lib/practice';

export const ANNOUNCEMENT_EMAIL_STATUSES = ['unknown', 'skipped', 'sent', 'failed', 'not_configured'] as const;

export type AnnouncementEmailStatus = (typeof ANNOUNCEMENT_EMAIL_STATUSES)[number];

export const ANNOUNCEMENT_EMAIL_STATUS_LABELS: Record<AnnouncementEmailStatus, string> = {
  unknown: 'Pending',
  skipped: 'Skipped',
  sent: 'Sent',
  failed: 'Failed',
  not_configured: 'Not configured',
};

export function announcementEmailStatusLabel(status?: string | null) {
  if (!status) return ANNOUNCEMENT_EMAIL_STATUS_LABELS.unknown;
  if (status in ANNOUNCEMENT_EMAIL_STATUS_LABELS) {
    return ANNOUNCEMENT_EMAIL_STATUS_LABELS[status as AnnouncementEmailStatus];
  }
  return ANNOUNCEMENT_EMAIL_STATUS_LABELS.unknown;
}

export function announcementEmailStatusTone(status?: string | null) {
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

export function buildFounderAnnouncementEmail({
  eventName,
  eventFocus,
  title,
  body,
  eventDescription,
}: {
  eventName: string;
  eventFocus: string;
  title: string;
  body: string;
  eventDescription?: string | null;
}) {
  const prompt = getPracticePrompt(eventFocus);
  const practiceNudge = nudgeCopy(prompt);
  const descriptionLine = eventDescription ? `<p style="line-height:1.7; color:#94a3b8; margin:0 0 18px;">${escapeHtml(eventDescription)}</p>` : '';

  return {
    subject: `${eventName}: ${prompt.title}`,
    text: [
      `${eventName} founder nudge`,
      '',
      title,
      '',
      body,
      '',
      'Pitch-practice nudge:',
      practiceNudge,
      '',
      'Next rep: record a 60-second take, tighten sentence one, and keep the ask specific.',
      ...(eventDescription ? ['', `Event context: ${eventDescription}`] : []),
    ].join('\n'),
    html: `
      <div style="font-family: Inter, Arial, sans-serif; background:#050608; color:#f8fafc; padding:24px;">
        <div style="max-width:680px; margin:0 auto; border:1px solid rgba(255,255,255,.14); border-radius:24px; padding:24px; background:#0f172a;">
          <p style="color:#22d3ee; font-size:12px; letter-spacing:.18em; text-transform:uppercase; font-weight:800;">Pitch in Public founder nudge</p>
          <h1 style="margin:8px 0 12px; font-size:30px;">${escapeHtml(title)}</h1>
          <p style="margin:0 0 20px; line-height:1.7; color:#cbd5e1;">${escapeHtml(body)}</p>
          ${descriptionLine}
          <div style="margin:24px 0; border-radius:20px; padding:20px; background:rgba(34,211,238,.08); border:1px solid rgba(34,211,238,.18);">
            <p style="margin:0 0 8px; font-size:12px; letter-spacing:.16em; text-transform:uppercase; font-weight:800; color:#67e8f9;">Pitch-practice nudge</p>
            <p style="margin:0; line-height:1.7; color:#e2e8f0;">${escapeHtml(practiceNudge)}</p>
          </div>
          <div style="border-radius:20px; padding:20px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08);">
            <p style="margin:0 0 8px; font-size:12px; letter-spacing:.16em; text-transform:uppercase; font-weight:800; color:#cbd5e1;">Next rep</p>
            <p style="margin:0; line-height:1.7; color:#f8fafc;">Record a 60-second take, tighten sentence one, and keep the ask specific.</p>
          </div>
          <p style="margin:20px 0 0; font-size:13px; color:#94a3b8;">This message is meant to push the room toward a cleaner pitch, not a long campaign sequence.</p>
        </div>
      </div>
    `,
  };
}
