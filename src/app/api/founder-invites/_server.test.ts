import assert from 'node:assert/strict';
import test from 'node:test';
import { getFounderInviteTokenFromNextPath } from './_server';

const validToken = 'a'.repeat(43);

test('extracts a valid founder invitation token', () => {
  assert.equal(
    getFounderInviteTokenFromNextPath(`/founder/invite?token=${validToken}`),
    validToken
  );
});

test('rejects unsafe redirects and unrelated paths', () => {
  assert.equal(getFounderInviteTokenFromNextPath(`//evil.example/founder/invite?token=${validToken}`), null);
  assert.equal(getFounderInviteTokenFromNextPath(`/auth/callback?token=${validToken}`), null);
  assert.equal(getFounderInviteTokenFromNextPath(`https://evil.example/founder/invite?token=${validToken}`), null);
});

test('rejects missing, short, and malformed tokens', () => {
  assert.equal(getFounderInviteTokenFromNextPath('/founder/invite'), null);
  assert.equal(getFounderInviteTokenFromNextPath('/founder/invite?token=short'), null);
  assert.equal(getFounderInviteTokenFromNextPath(`/founder/invite?token=${'a'.repeat(31)}!`), null);
});
