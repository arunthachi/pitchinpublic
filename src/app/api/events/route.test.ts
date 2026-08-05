import assert from 'node:assert/strict';
import test from 'node:test';
import * as eventRoute from './route';

const { hashEventCreationPayload, parseEventIdempotencyKey } = eventRoute;

const KEY = '91b5b63e-62f5-4878-bb0b-3264cf78be1c';

test('event idempotency keys are optional but reject non-UUID values', () => {
  assert.deepEqual(parseEventIdempotencyKey(null), { key: null, valid: true });
  assert.deepEqual(parseEventIdempotencyKey(` ${KEY} `), { key: KEY, valid: true });
  assert.deepEqual(parseEventIdempotencyKey('event-create'), { key: null, valid: false });
});

test('event creation hashes distinguish mismatched replay payloads', () => {
  const payload = {
    name: 'Demo Night',
    eventDate: '2026-09-12',
    visibility: 'unlisted',
    reviewTarget: 3,
  };

  assert.equal(hashEventCreationPayload(payload), hashEventCreationPayload({ ...payload }));
  assert.notEqual(
    hashEventCreationPayload(payload),
    hashEventCreationPayload({ ...payload, reviewTarget: 4 })
  );
});

test('event collection route does not expose DELETE', () => {
  assert.equal(Reflect.has(eventRoute, 'DELETE'), false);
});
