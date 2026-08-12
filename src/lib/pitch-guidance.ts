import { z } from 'zod';

export const feedbackDisclosureModes = ['named', 'role_only', 'anonymous_to_founder'] as const;

export const guidelineCriterionSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,39}$/),
  label: z.string().trim().min(2).max(80),
  guidance: z.string().trim().max(600).default(''),
}).strict();

export const publishGuidelinesSchema = z.object({
  revision: z.number().int().positive(),
  idempotencyKey: z.string().uuid(),
}).strict();

export const saveGuidelineDraftSchema = z.object({
  revision: z.number().int().positive(),
  title: z.string().trim().min(3).max(120),
  instructions: z.string().trim().max(4000).default(''),
  criteria: z.array(guidelineCriterionSchema).min(4).max(6),
  disclosureMode: z.enum(feedbackDisclosureModes).default('role_only'),
}).strict().superRefine((value, context) => {
  if (new Set(value.criteria.map((criterion) => criterion.key)).size !== value.criteria.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['criteria'], message: 'Criterion keys must be unique.' });
});

export const recordingSessionSchema = z.object({ recordingSessionId: z.string().uuid() }).strict();

export const founderBriefSchema = z.object({
  tagline: z.string().trim().max(60).default(''),
  businessStage: z.string().trim().max(80).default(''),
  industry: z.string().trim().max(120).default(''),
  businessDescription: z.string().trim().max(1800).default(''),
  problem: z.string().trim().max(1200).default(''),
  ask: z.string().trim().max(600).default(''),
}).strict();

export const selectGuidanceActionSchema = z.object({ feedbackId: z.string().uuid() }).strict();
export const addressGuidanceActionSchema = z.object({ laterPitchId: z.string().uuid() }).strict();

export function firstGuidanceIssue(error: z.ZodError) {
  const issue = error.issues[0];
  if (issue?.path[0] === 'revision') {
    return 'This event’s pitch standard setup is incomplete. Reload the page and try again.';
  }
  return issue?.message || 'Invalid pitch guidance data.';
}

export function eligibleEventSubmissionPitches<T extends { event_id?: string | null; event_guideline_version_id?: string | null; event_recording_session_id?: string | null }>(
  pitches: T[],
  event: { id: string; guidance_mode?: string | null } | null | undefined,
) {
  if (!event || event.guidance_mode !== 'structured_active') return pitches;
  return pitches.filter((pitch) => pitch.event_id === event.id && Boolean(pitch.event_guideline_version_id) && Boolean(pitch.event_recording_session_id));
}
