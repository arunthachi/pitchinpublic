import assert from 'node:assert/strict';
import test from 'node:test';
import { createClientIdempotencyKey } from './idempotency';

test('creates UUID-shaped client idempotency keys', () => {
  assert.match(
    createClientIdempotencyKey(),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});
