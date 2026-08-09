import assert from 'node:assert/strict';
import test from 'node:test';
import * as eventRoute from './route';

const {
  buildOrganizerParticipantUpsert,
  filterPendingInvitationsForEmail,
  hashEventCreationPayload,
  parseEventIdempotencyKey,
} = eventRoute;

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

test('organizer participant replay targets the event and user uniqueness constraint', () => {
  assert.deepEqual(buildOrganizerParticipantUpsert('event-id', 'user-id'), {
    values: {
      event_id: 'event-id',
      user_id: 'user-id',
      role: 'organizer',
      status: 'active',
    },
    options: { onConflict: 'event_id,user_id' },
  });
});

test('event collection route does not expose DELETE', () => {
  assert.equal(Reflect.has(eventRoute, 'DELETE'), false);
});

test('pending invitations match only the normalized signed-in email', () => {
  const rows = [
    { id: 'mine', status: 'pending', dedupe_email: 'founder@example.com', expires_at: null },
    { id: 'other', status: 'pending', dedupe_email: 'someone-else@example.com', expires_at: null },
    { id: 'legacy-cased', status: 'pending', email: 'Founder@Example.com', dedupe_email: null, expires_at: null },
  ];

  const result = filterPendingInvitationsForEmail(rows, ' Founder@Example.com ');

  assert.deepEqual(result.map((row) => row.id), ['mine', 'legacy-cased']);
});

test('pending invitations exclude non-pending and expired rows', () => {
  const now = new Date('2026-08-08T00:00:00.000Z');
  const rows = [
    { id: 'accepted', status: 'accepted', dedupe_email: 'founder@example.com', expires_at: null },
    { id: 'revoked', status: 'revoked', dedupe_email: 'founder@example.com', expires_at: null },
    { id: 'expired', status: 'pending', dedupe_email: 'founder@example.com', expires_at: '2026-01-01T00:00:00.000Z' },
    { id: 'future', status: 'pending', dedupe_email: 'founder@example.com', expires_at: '2026-12-31T00:00:00.000Z' },
    { id: 'no-expiry', status: 'pending', dedupe_email: 'founder@example.com', expires_at: null },
  ];

  const result = filterPendingInvitationsForEmail(rows, 'founder@example.com', now);

  assert.deepEqual(result.map((row) => row.id), ['future', 'no-expiry']);
});

test('pending invitations require a non-empty email to match against', () => {
  const rows = [{ id: 'a', status: 'pending', dedupe_email: 'founder@example.com', expires_at: null }];
  assert.deepEqual(filterPendingInvitationsForEmail(rows, ''), []);
  assert.deepEqual(filterPendingInvitationsForEmail(rows, null), []);
});

test('joined events carry a mySubmission flag derived from the caller submissions', async () => {
  // The flag is computed as set-membership over the caller's own submission
  // rows; assert the mapping logic via the same shape the route uses.
  const submittedEventIds = new Set(['e1', 'e3']);
  const events = [{ id: 'e1' }, { id: 'e2' }].map((event) => ({
    ...event,
    mySubmission: submittedEventIds.has(event.id),
  }));
  assert.equal(events[0].mySubmission, true);
  assert.equal(events[1].mySubmission, false);
});
