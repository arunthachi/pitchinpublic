import { createHash } from 'crypto';
import { z } from 'zod';
import { normalizeEmail } from '@/lib/admin';

const idempotencyKeySchema = z.string().uuid();

export function parseEventIdempotencyKey(value: string | null) {
  if (!value) return { key: null, valid: true } as const;
  const parsed = idempotencyKeySchema.safeParse(value.trim());
  return parsed.success ? ({ key: parsed.data, valid: true } as const) : ({ key: null, valid: false } as const);
}

export function hashEventCreationPayload(payload: unknown) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export type PendingEventInvitationRow = {
  id: string;
  status?: string | null;
  email?: string | null;
  dedupe_email?: string | null;
  expires_at?: string | null;
};

export function filterPendingInvitationsForEmail<T extends PendingEventInvitationRow>(rows: T[], email: string | null | undefined, now: Date = new Date()): T[] {
  const normalized = normalizeEmail(email);
  if (!normalized) return [];
  return rows.filter((row) => {
    if (row.status !== 'pending') return false;
    if (normalizeEmail(row.dedupe_email ?? row.email) !== normalized) return false;
    if (!row.expires_at) return true;
    const expiresAt = new Date(row.expires_at).getTime();
    return !(Number.isFinite(expiresAt) && expiresAt <= now.getTime());
  });
}

export function buildOrganizerParticipantUpsert(eventId: string, userId: string) {
  return { values: { event_id: eventId, user_id: userId, role: 'organizer', status: 'active' }, options: { onConflict: 'event_id,user_id' } } as const;
}

export function toSafeEventsWithSubmissionFlag(rows: Array<Record<string, unknown> & { id: string }>, submittedEventIds: Set<string> | null) {
  return rows.map((event) => {
    const safeEvent = { ...event } as Record<string, unknown>;
    delete safeEvent.access_code;
    delete safeEvent.creation_key;
    delete safeEvent.creation_payload_hash;
    safeEvent.mySubmission = submittedEventIds ? submittedEventIds.has(event.id) : null;
    return safeEvent;
  });
}
