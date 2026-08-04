import assert from 'node:assert/strict';
import test from 'node:test';
import { isAllowedPilotAdmin } from './pilot-admin-access';

test('fails closed when the pilot admin allowlist is missing', () => {
  const previousPrivate = process.env.PILOT_ADMIN_EMAILS;
  const previousPublic = process.env.NEXT_PUBLIC_PILOT_ADMIN_EMAILS;

  try {
    delete process.env.PILOT_ADMIN_EMAILS;
    delete process.env.NEXT_PUBLIC_PILOT_ADMIN_EMAILS;
    assert.equal(isAllowedPilotAdmin('founder@example.com'), false);
    assert.equal(isAllowedPilotAdmin(null), false);
  } finally {
    if (previousPrivate === undefined) delete process.env.PILOT_ADMIN_EMAILS;
    else process.env.PILOT_ADMIN_EMAILS = previousPrivate;
    if (previousPublic === undefined) delete process.env.NEXT_PUBLIC_PILOT_ADMIN_EMAILS;
    else process.env.NEXT_PUBLIC_PILOT_ADMIN_EMAILS = previousPublic;
  }
});

test('matches configured pilot admins case-insensitively and denies everyone else', () => {
  const previousPrivate = process.env.PILOT_ADMIN_EMAILS;

  try {
    process.env.PILOT_ADMIN_EMAILS = ' operator@example.com,ADMIN@example.com ';
    assert.equal(isAllowedPilotAdmin('admin@example.com'), true);
    assert.equal(isAllowedPilotAdmin('outsider@example.com'), false);
  } finally {
    if (previousPrivate === undefined) delete process.env.PILOT_ADMIN_EMAILS;
    else process.env.PILOT_ADMIN_EMAILS = previousPrivate;
  }
});
