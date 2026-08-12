import { createHash } from 'crypto';
import { z } from 'zod';

const idempotencyKeySchema = z.string().uuid();

export function parsePitchIdempotencyKey(value: string | null) {
  if (!value) return { key: null, valid: true } as const;
  const parsed = idempotencyKeySchema.safeParse(value.trim());
  return parsed.success ? ({ key: parsed.data, valid: true } as const) : ({ key: null, valid: false } as const);
}

export function hashPitchCreationPayload(payload: unknown) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function structuredFeedbackProvenance(feedback: Record<string, any>) {
  const disclosureMode = feedback.disclosure_mode || 'role_only';
  return {
    event_guideline_version_id: feedback.event_guideline_version_id || null,
    criterion_key: feedback.criterion_key || null,
    observation: feedback.observation || null,
    next_step: feedback.next_step || null,
    disclosure_mode: disclosureMode,
    author_name: disclosureMode === 'named' ? feedback.author?.full_name || null : null,
    display_role_only: disclosureMode !== 'named',
  };
}
