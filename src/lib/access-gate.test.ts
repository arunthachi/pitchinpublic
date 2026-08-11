import assert from 'node:assert/strict';
import test from 'node:test';
import { accessCheckKey, isRoleResolved, shouldShowAccessGate } from './access-gate';

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

// ── silent re-verification keeps revocation enforceable ──────────────────────

test('no re-verification before the first check has run', async () => {
  const { shouldReverifyAccess } = await import('./access-gate');
  assert.equal(shouldReverifyAccess({ lastCheckedAt: null, now: 1_000_000, reason: 'interval' }), false);
  assert.equal(shouldReverifyAccess({ lastCheckedAt: null, now: 1_000_000, reason: 'focus' }), false);
});

test('tab focus re-verifies, but not more often than the floor', async () => {
  const { shouldReverifyAccess, ACCESS_REVERIFY_MIN_GAP_MS } = await import('./access-gate');
  const t0 = 1_000_000;
  // Flapping focus must not storm the API.
  assert.equal(shouldReverifyAccess({ lastCheckedAt: t0, now: t0 + 5_000, reason: 'focus' }), false);
  assert.equal(
    shouldReverifyAccess({ lastCheckedAt: t0, now: t0 + ACCESS_REVERIFY_MIN_GAP_MS, reason: 'focus' }),
    true,
  );
});

test('the interval re-verifies on its own cadence', async () => {
  const { shouldReverifyAccess, ACCESS_REVERIFY_INTERVAL_MS } = await import('./access-gate');
  const t0 = 1_000_000;
  assert.equal(
    shouldReverifyAccess({ lastCheckedAt: t0, now: t0 + ACCESS_REVERIFY_INTERVAL_MS - 1, reason: 'interval' }),
    false,
  );
  assert.equal(
    shouldReverifyAccess({ lastCheckedAt: t0, now: t0 + ACCESS_REVERIFY_INTERVAL_MS, reason: 'interval' }),
    true,
  );
});

test('revocation stays enforceable: a long-open tab re-checks without blanking', async () => {
  const { shouldReverifyAccess, shouldShowAccessGate } = await import('./access-gate');
  const t0 = 1_000_000;
  const anHourLater = t0 + 60 * 60 * 1000;
  assert.equal(shouldReverifyAccess({ lastCheckedAt: t0, now: anHourLater, reason: 'interval' }), true);
  // ...and that re-check never shows the blocking screen.
  assert.equal(
    shouldShowAccessGate({
      loading: false,
      isGuest: false,
      authPending: false,
      accessCheckComplete: false,
      hasVerifiedAccessOnce: true,
    }),
    false,
  );
});

test('reviewer mode is adopted only on the first check, never on a re-check', async () => {
  const { shouldAdoptReviewerMode } = await import('./access-gate');
  assert.equal(shouldAdoptReviewerMode(false), true, 'first verification may set the mode');
  assert.equal(
    shouldAdoptReviewerMode(true),
    false,
    'a background re-check must not flip modes — that unmounts a recording in progress',
  );
});

test('a founder 403 from the reviewer lookup is a definitive role answer', () => {
  // /api/reviewer/access replies 403 'reviewer_access_required' to any founder
  // without reviewer membership. Treating only 2xx as resolved would gate the
  // recorder shut for nearly every user of the product.
  assert.equal(isRoleResolved(403), true);
  assert.equal(isRoleResolved(200), true);
});

test('an undecided role never counts as resolved', () => {
  // 401: the session is not valid, so we know nothing about the role.
  assert.equal(isRoleResolved(401), false);
  // 5xx: the service failed, including the 503 for unconfigured reviewer storage.
  for (const status of [500, 502, 503, 504]) {
    assert.equal(isRoleResolved(status), false, `${status} must not resolve the role`);
  }
});

test('every status the reviewer route can return is classified', () => {
  // Mirrors src/app/api/reviewer/access/route.ts.
  assert.deepEqual(
    [200, 401, 403, 500, 503].map(isRoleResolved),
    [true, false, true, false, false],
  );
});
