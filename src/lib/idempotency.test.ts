import assert from 'node:assert/strict';
import test from 'node:test';
import { createClientIdempotencyKey, getEventSubmissionRetryKey } from './idempotency';

test('creates UUID-shaped client idempotency keys', () => {
  assert.match(
    createClientIdempotencyKey(),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});

test('scopes event submission recovery to both account and event', () => {
  assert.equal(
    getEventSubmissionRetryKey('demo-day', 'user@example.com'),
    'pitchinpublic:event-submission:user%40example.com:demo-day',
  );
  assert.notEqual(
    getEventSubmissionRetryKey('demo-day', 'user-a'),
    getEventSubmissionRetryKey('demo-day', 'user-b'),
  );
});
