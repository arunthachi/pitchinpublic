import { z } from 'zod';

export const feedbackDisclosureModes = ['named', 'role_only', 'anonymous_to_founder'] as const;

export const guidelineCriterionSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,39}$/),
  label: z.string().trim().min(2).max(80),
  guidance: z.string().trim().max(600).default(''),
}).strict();

export const publishGuidelinesSchema = z.object({
  title: z.string().trim().min(3).max(120),
  instructions: z.string().trim().max(4000).default(''),
  criteria: z.array(guidelineCriterionSchema).min(4).max(6),
  disclosureMode: z.enum(feedbackDisclosureModes).default('role_only'),
}).strict().superRefine((value, context) => {
  const keys = value.criteria.map((criterion) => criterion.key);
  if (new Set(keys).size !== keys.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['criteria'], message: 'Criterion keys must be unique.' });
  }
});

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
  return error.issues[0]?.message || 'Invalid pitch guidance data.';
}
