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

test('joined events carry a mySubmission flag and shed secret columns', async () => {
  const { toSafeEventsWithSubmissionFlag } = await import('./route');
  const events = toSafeEventsWithSubmissionFlag(
    [
      { id: 'e1', name: 'One', access_code: 'secret', creation_key: 'k', creation_payload_hash: 'h' },
      { id: 'e2', name: 'Two' },
    ],
    new Set(['e1', 'e3']),
  );
  assert.equal(events[0].mySubmission, true);
  assert.equal(events[1].mySubmission, false);
  assert.equal('access_code' in events[0], false, 'secret columns must not survive');
  assert.equal('creation_key' in events[0], false);
  assert.equal('creation_payload_hash' in events[0], false);
  assert.equal(events[0].name, 'One');
});

test('unknown submission state stamps null so the UI shows no chip', async () => {
  const { toSafeEventsWithSubmissionFlag } = await import('./route');
  const events = toSafeEventsWithSubmissionFlag([{ id: 'e1' }], null);
  assert.equal(events[0].mySubmission, null);
});

test('integrated event creation is delegated to one atomic database RPC', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('./route.ts', import.meta.url), 'utf8');
  assert.match(source, /rpc\('create_event_with_standard_draft'/);
  assert.doesNotMatch(source, /\.from\('pitch_events'\)\s*\.insert/);
});
