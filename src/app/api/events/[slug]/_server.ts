import { z } from 'zod';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.');
const optionalDateSchema = dateSchema.or(z.literal(''));
const optionalDateTimeSchema = z.string().datetime().or(z.literal(''));

export const eventUpdateSchema = z
  .object({
    name: z.string().trim().min(3).max(120).optional(),
    description: z.string().trim().max(1000).optional(),
    eventDate: dateSchema.optional(),
    submissionDeadline: optionalDateSchema.optional(),
    pitchLengthSeconds: z.coerce.number().int().min(30).max(360).optional(),
    focuses: z.array(z.string().trim().min(2).max(40)).min(1).max(12).optional(),
    visibility: z.enum(['private', 'unlisted', 'public']).optional(),
    accessCodeAction: z.enum(['keep', 'replace', 'remove']).optional(),
    accessCode: z.string().trim().max(32).optional(),
    reviewTarget: z.coerce.number().int().min(1).max(10).optional(),
    pitchHourStartsAt: optionalDateTimeSchema.optional(),
    pitchHourEndsAt: optionalDateTimeSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Add at least one event change.' });
    }

    const hasPitchHourStart = value.pitchHourStartsAt !== undefined;
    const hasPitchHourEnd = value.pitchHourEndsAt !== undefined;
    if (hasPitchHourStart !== hasPitchHourEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pitchHourStartsAt'],
        message: 'Choose both a start and end for Pitch Hour.',
      });
    }

    if (
      value.pitchHourStartsAt &&
      value.pitchHourEndsAt &&
      new Date(value.pitchHourEndsAt) <= new Date(value.pitchHourStartsAt)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pitchHourEndsAt'],
        message: 'Pitch Hour must end after it starts.',
      });
    }

    if (value.accessCodeAction === 'replace' && (!value.accessCode || value.accessCode.length < 4)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['accessCode'],
        message: 'Use an access code between 4 and 32 characters.',
      });
    }

    if (value.accessCodeAction !== 'replace' && value.accessCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['accessCode'],
        message: 'Choose replace before entering a new access code.',
      });
    }
  });

export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;

export type CurrentEventSettings = {
  event_date: string;
  submission_deadline: string | null;
};

export type EventManagerContext = {
  userId: string;
  organizerId: string;
  participantRole?: string | null;
  participantStatus?: string | null;
};

export type EventDatabaseUpdate = {
  name?: string;
  description?: string | null;
  event_date?: string;
  submission_deadline?: string | null;
  pitch_length_seconds?: number;
  focus?: string;
  visibility?: 'private' | 'unlisted' | 'public';
  access_code?: string | null;
  review_target?: number;
  pitch_hour_starts_at?: string | null;
  pitch_hour_ends_at?: string | null;
  updated_at: string;
};

export function canManageEvent(context: EventManagerContext) {
  if (context.userId === context.organizerId) return true;
  return (
    context.participantStatus === 'active' &&
    (context.participantRole === 'organizer' || context.participantRole === 'admin')
  );
}

function calendarDate(value: string | null | undefined) {
  if (!value) return '';
  return value.slice(0, 10);
}

function normalizeFocuses(focuses: string[]) {
  const seen = new Set<string>();
  return focuses
    .map((focus) => focus.trim())
    .filter((focus) => {
      const key = focus.toLocaleLowerCase();
      if (!focus || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function parseEventUpdate(
  body: unknown,
  current: CurrentEventSettings,
  now = new Date()
):
  | { success: true; update: EventDatabaseUpdate }
  | { success: false; issues: Record<string, string[]> } {
  const validation = eventUpdateSchema.safeParse(body);
  if (!validation.success) {
    return { success: false, issues: validation.error.flatten().fieldErrors };
  }

  const data = validation.data;
  const eventDate = data.eventDate ?? calendarDate(current.event_date);
  const deadline =
    data.submissionDeadline !== undefined
      ? data.submissionDeadline
      : calendarDate(current.submission_deadline);

  if (deadline && deadline > eventDate) {
    return {
      success: false,
      issues: { submissionDeadline: ['Submission deadline must be on or before pitch day.'] },
    };
  }

  const update: EventDatabaseUpdate = { updated_at: now.toISOString() };
  if (data.name !== undefined) update.name = data.name;
  if (data.description !== undefined) update.description = data.description || null;
  if (data.eventDate !== undefined) update.event_date = data.eventDate;
  if (data.submissionDeadline !== undefined) {
    update.submission_deadline = data.submissionDeadline || null;
  }
  if (data.pitchLengthSeconds !== undefined) {
    update.pitch_length_seconds = data.pitchLengthSeconds;
  }
  if (data.focuses !== undefined) {
    const focus = normalizeFocuses(data.focuses).join(' · ');
    if (!focus || focus.length > 160) {
      return {
        success: false,
        issues: { focuses: ['Choose focus areas with a combined length of 160 characters or less.'] },
      };
    }
    update.focus = focus;
  }
  if (data.visibility !== undefined) update.visibility = data.visibility;
  if (data.reviewTarget !== undefined) update.review_target = data.reviewTarget;
  if (data.pitchHourStartsAt !== undefined && data.pitchHourEndsAt !== undefined) {
    update.pitch_hour_starts_at = data.pitchHourStartsAt || null;
    update.pitch_hour_ends_at = data.pitchHourEndsAt || null;
  }
  if (data.accessCodeAction === 'replace') update.access_code = data.accessCode || null;
  if (data.accessCodeAction === 'remove') update.access_code = null;

  return { success: true, update };
}

export function firstEventUpdateIssue(issues: Record<string, string[]>) {
  return Object.values(issues).flat().find(Boolean) || 'Invalid event data.';
}
