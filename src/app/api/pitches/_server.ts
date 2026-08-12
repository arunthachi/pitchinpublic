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
