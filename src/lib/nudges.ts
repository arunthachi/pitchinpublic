import { escapeHtml } from './email';
import { PracticePrompt } from './practice';

const DEFAULT_APP_URL = 'https://app.pitchinpublic.io';
const DEFAULT_TIME_ZONE = 'America/New_York';
const DEFAULT_NUDGE_TIME = '09:00:00';
const PREFERENCES_PATH = '/notifications/preferences';

const DAILY_LEAD_LINE = 'Today’s pitch task: make the customer obvious in sentence one. Record a 60-sec take.';

export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL).replace(/\/$/, '');
}

export function getPitchHomeUrl() {
  return `${getAppUrl()}/`;
}

export function getNotificationPreferencesUrl() {
  return `${getAppUrl()}${PREFERENCES_PATH}`;
}

export function getEventRoomUrl(slug?: string | null) {
  const normalizedSlug = (slug || '').trim();
  if (!normalizedSlug) return getPitchHomeUrl();
  return `${getAppUrl()}/events/${encodeURIComponent(normalizedSlug)}`;
}

export function formatPitchLength(seconds?: number | null) {
  if (!seconds || Number.isNaN(seconds)) return '60 seconds';
  if (seconds < 60) return `${seconds} seconds`;

  const minutes = seconds / 60;
  if (Number.isInteger(minutes)) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }

  return `${Math.round(minutes)} minutes`;
}

export function formatDeadlineLabel(value?: string | null, timeZone?: string | null) {
  if (!value) return 'No deadline set';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No deadline set';

  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timeZone || DEFAULT_TIME_ZONE,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }
}

export function formatDateOnlyLabel(value?: string | null) {
  if (!value) return 'No date set';

  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 'No date set';

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
  }).format(date);
}

export function getZonedDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  const hour = Number(lookup.hour || '0') % 24;
  const minute = Number(lookup.minute || '0');

  return {
    year: Number(lookup.year || '1970'),
    month: Number(lookup.month || '1'),
    day: Number(lookup.day || '1'),
    hour,
    minute,
    dateKey: `${lookup.year || '1970'}-${lookup.month || '01'}-${lookup.day || '01'}`,
  };
}

function parseNudgeTime(value?: string | null) {
  const normalized = (value || DEFAULT_NUDGE_TIME).trim();
  const [hourPart = '09', minutePart = '00'] = normalized.split(':');
  return {
    hour: Number(hourPart),
    minute: Number(minutePart),
  };
}

export function getLocalDateKey(date: Date, timeZone?: string | null) {
  return getZonedDateParts(date, timeZone || DEFAULT_TIME_ZONE).dateKey;
}

export function shouldSendDailyNudge({
  now = new Date(),
  timeZone,
  dailyNudgeTime,
}: {
  now?: Date;
  timeZone?: string | null;
  dailyNudgeTime?: string | null;
}) {
  const local = getZonedDateParts(now, timeZone || DEFAULT_TIME_ZONE);
  const scheduled = parseNudgeTime(dailyNudgeTime);
  const currentMinutes = local.hour * 60 + local.minute;
  const scheduledMinutes = scheduled.hour * 60 + scheduled.minute;

  return currentMinutes >= scheduledMinutes;
}

export function shouldSendEventReminder({
  submissionDeadline,
  now = new Date(),
}: {
  submissionDeadline?: string | null;
  now?: Date;
}) {
  if (!submissionDeadline) return false;

  const deadline = new Date(submissionDeadline);
  if (Number.isNaN(deadline.getTime())) return false;

  const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursRemaining > 0 && hoursRemaining <= 24;
}

function buildEmailShell({
  eyebrow,
  title,
  paragraphs,
  details,
  actionLabel,
  actionHref,
  footer,
}: {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  details: Array<{ label: string; value: string }>;
  actionLabel: string;
  actionHref: string;
  footer: string;
}) {
  const detailsMarkup = details
    .map(
      (detail) => `
        <div style="border-radius:18px; padding:16px 18px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); margin-bottom:10px;">
          <p style="margin:0 0 6px; font-size:11px; letter-spacing:.16em; text-transform:uppercase; font-weight:800; color:#67e8f9;">${escapeHtml(detail.label)}</p>
          <p style="margin:0; line-height:1.65; color:#e2e8f0;">${escapeHtml(detail.value)}</p>
        </div>
      `
    )
    .join('');

  return `
    <div style="font-family: Inter, Arial, sans-serif; background:#050608; color:#f8fafc; padding:24px;">
      <div style="max-width:680px; margin:0 auto; border:1px solid rgba(255,255,255,.12); border-radius:24px; padding:24px; background:#0f172a;">
        <p style="color:#22d3ee; font-size:12px; letter-spacing:.18em; text-transform:uppercase; font-weight:800;">${escapeHtml(eyebrow)}</p>
        <h1 style="margin:8px 0 14px; font-size:30px; line-height:1.1;">${escapeHtml(title)}</h1>
        ${paragraphs
          .map((paragraph) => `<p style="margin:0 0 14px; line-height:1.7; color:#cbd5e1;">${escapeHtml(paragraph)}</p>`)
          .join('')}
        <div style="margin:22px 0 18px; padding:4px 0 0;">
          ${detailsMarkup}
        </div>
        <a href="${escapeHtml(actionHref)}" style="display:inline-block; margin:8px 0 14px; border-radius:999px; background:linear-gradient(90deg,#22d3ee,#a3e635); color:#020617; font-weight:800; text-decoration:none; padding:14px 18px;">${escapeHtml(actionLabel)}</a>
        <p style="margin:4px 0 0; font-size:13px; color:#94a3b8; line-height:1.6;">${escapeHtml(footer)}</p>
      </div>
    </div>
  `;
}

export function buildDailyPitchNudgeEmail({
  founderName,
  prompt,
}: {
  founderName?: string | null;
  prompt: PracticePrompt;
}) {
  const greeting = founderName ? `Hi ${founderName},` : 'Hi founder,';
  const practiceUrl = getPitchHomeUrl();
  const preferencesUrl = getNotificationPreferencesUrl();
  const subject = `Today’s pitch task: ${prompt.title}`;

  return {
    subject,
    text: [
      greeting,
      '',
      DAILY_LEAD_LINE,
      '',
      `Practice focus: ${prompt.title}`,
      prompt.prompt,
      '',
      `Why it matters: ${prompt.why}`,
      '',
      `Open your practice room: ${practiceUrl}`,
      `Manage email preferences: ${preferencesUrl}`,
      '',
      'Automated nudge only. Organizer announcements are separate.',
    ].join('\n'),
    html: buildEmailShell({
      eyebrow: 'Pitch in Public daily nudge',
      title: DAILY_LEAD_LINE,
      paragraphs: [
        greeting,
        `Practice focus: ${prompt.title}. ${prompt.prompt}`,
        `Why it matters: ${prompt.why}`,
      ],
      details: [
        { label: 'Practice room', value: practiceUrl },
        { label: 'Email preferences', value: preferencesUrl },
      ],
      actionLabel: 'Open practice room',
      actionHref: practiceUrl,
      footer: 'Automated nudge only. Organizer announcements are separate.',
    }),
  };
}

export function buildEventDeadlineNudgeEmail({
  founderName,
  eventName,
  eventSlug,
  focusPrompt,
  pitchLengthSeconds,
  submissionDeadline,
  eventDate,
}: {
  founderName?: string | null;
  eventName: string;
  eventSlug?: string | null;
  focusPrompt: PracticePrompt;
  pitchLengthSeconds?: number | null;
  submissionDeadline?: string | null;
  eventDate?: string | null;
}) {
  const greeting = founderName ? `Hi ${founderName},` : 'Hi founder,';
  const eventUrl = getEventRoomUrl(eventSlug);
  const preferencesUrl = getNotificationPreferencesUrl();
  const deadlineLabel = formatDeadlineLabel(submissionDeadline);
  const pitchLengthLabel = formatPitchLength(pitchLengthSeconds);

  return {
    subject: `${eventName} deadline reminder`,
    text: [
      greeting,
      '',
      DAILY_LEAD_LINE,
      '',
      `${eventName} is due soon.`,
      `Deadline: ${deadlineLabel}`,
      `Pitch length: ${pitchLengthLabel}`,
      eventDate ? `Pitch day: ${formatDateOnlyLabel(eventDate)}` : null,
      '',
      `Practice focus: ${focusPrompt.title}`,
      focusPrompt.prompt,
      '',
      `Open your event room: ${eventUrl}`,
      `Manage email preferences: ${preferencesUrl}`,
      '',
      'Automated nudge only. Organizer announcements are separate.',
    ]
      .filter((line): line is string => line !== null)
      .join('\n'),
    html: buildEmailShell({
      eyebrow: 'Pitch in Public deadline reminder',
      title: `${eventName} is due soon`,
      paragraphs: [
        greeting,
        DAILY_LEAD_LINE,
        `Deadline: ${deadlineLabel}`,
        `Pitch length: ${pitchLengthLabel}`,
        eventDate ? `Pitch day: ${formatDateOnlyLabel(eventDate)}` : '',
        `Practice focus: ${focusPrompt.title}. ${focusPrompt.prompt}`,
      ].filter(Boolean),
      details: [
        { label: 'Event room', value: eventUrl },
        { label: 'Email preferences', value: preferencesUrl },
      ],
      actionLabel: 'Open event room',
      actionHref: eventUrl,
      footer: 'Automated nudge only. Organizer announcements are separate.',
    }),
  };
}
