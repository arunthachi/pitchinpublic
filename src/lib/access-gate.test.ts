import assert from 'node:assert/strict';
import test from 'node:test';
import { accessCheckKey, shouldShowAccessGate } from './access-gate';

const base = {
  loading: false,
  isGuest: false,
  authPending: false,
  accessCheckComplete: false,
  hasVerifiedAccessOnce: false,
};

test('the first signed-in verification blocks with the access screen', () => {
  assert.equal(shouldShowAccessGate(base), true);
});

test('once access has been verified, no re-check may blank the app', () => {
  // This is the bug: a token refresh or tab refocus re-runs the check, and
  // the old gate blanked the whole tree — destroying an in-flight recording.
  assert.equal(
    shouldShowAccessGate({ ...base, accessCheckComplete: false, hasVerifiedAccessOnce: true }),
    false,
  );
  assert.equal(
    shouldShowAccessGate({ ...base, accessCheckComplete: true, hasVerifiedAccessOnce: true }),
    false,
  );
});

test('a completed first check stops blocking', () => {
  assert.equal(shouldShowAccessGate({ ...base, accessCheckComplete: true }), false);
});

test('guests only see it while the sign-in handoff is pending', () => {
  assert.equal(shouldShowAccessGate({ ...base, isGuest: true, loading: true, authPending: true }), true);
  assert.equal(shouldShowAccessGate({ ...base, isGuest: true, loading: true, authPending: false }), false);
  assert.equal(shouldShowAccessGate({ ...base, isGuest: true, loading: false, authPending: true }), false);
});

test('the check re-runs per identity, not per republished session object', () => {
  assert.equal(accessCheckKey('user-1'), 'user-1');
  assert.equal(accessCheckKey(null), '');
  assert.equal(accessCheckKey(undefined), '');
  // Same person, new session object => same key => no re-run.
  assert.equal(accessCheckKey('user-1') === accessCheckKey('user-1'), true);
});
