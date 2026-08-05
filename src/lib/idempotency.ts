export function createClientIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  const random = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(random);
  } else {
    random.forEach((_, index) => {
      random[index] = Math.floor(Math.random() * 256);
    });
  }

  random[6] = (random[6] & 0x0f) | 0x40;
  random[8] = (random[8] & 0x3f) | 0x80;
  const value = Array.from(random, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

const EVENT_SUBMISSION_RETRY_PREFIX = 'pitchinpublic:event-submission:';

export function getEventSubmissionRetryKey(eventSlug: string, userId: string) {
  return `${EVENT_SUBMISSION_RETRY_PREFIX}${encodeURIComponent(userId)}:${eventSlug}`;
}
