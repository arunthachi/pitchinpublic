import assert from 'node:assert/strict';
import test from 'node:test';
import * as inviteRoute from './route';

const { inviteOperationFlags, normalizeEmail } = inviteRoute;

test('invite dedupe normalizes email casing and whitespace', () => {
  assert.equal(normalizeEmail('  Founder@Example.COM '), 'founder@example.com');
  assert.equal(normalizeEmail(''), '');
  assert.equal(normalizeEmail(null), '');
});

test('invite results report creation and delivery outcomes independently', () => {
  assert.deepEqual(inviteOperationFlags(true, 'sent'), {
    invite_created: true,
    email_sent: true,
    email_failed: false,
  });
  assert.deepEqual(inviteOperationFlags(false, 'failed'), {
    invite_created: false,
    email_sent: false,
    email_failed: true,
  });
  assert.deepEqual(inviteOperationFlags(false, 'skipped'), {
    invite_created: false,
    email_sent: false,
    email_failed: false,
  });
});

test('accepted invites are treated as active access instead of new work', () => {
  assert.deepEqual(inviteOperationFlags(false, 'sent'), {
    invite_created: false,
    email_sent: true,
    email_failed: false,
  });
});

test('invite route does not expose DELETE', () => {
  assert.equal(Reflect.has(inviteRoute, 'DELETE'), false);
});
