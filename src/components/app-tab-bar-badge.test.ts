import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  hasPendingInvitations,
  PENDING_INVITATIONS_CACHE_KEY,
  PENDING_INVITATIONS_TTL_MS,
  readCachedInvitationsBadge,
  writeCachedInvitationsBadge,
  type PendingInvitationsStorage,
} from '@/lib/pending-invitations';

/**
 * `AppTabBar` sources its invitation dot from `/api/events` and caches the
 * answer so a founder tapping between /events, /events/[slug], /profile, and
 * /pitch does not re-hit that endpoint on every navigation. These tests cover
 * the two pieces of logic that decide what the dot shows: decoding the API
 * payload, and the sessionStorage-backed cache around it.
 */

function fakeStorage(initial: Record<string, string> = {}): PendingInvitationsStorage {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
  };
}

test('hasPendingInvitations: true when the API reports at least one invitation', () => {
  assert.equal(
    hasPendingInvitations({ success: true, invitations: [{ id: 'inv-1' }] }),
    true,
  );
});

test('hasPendingInvitations: false for an empty invitations array', () => {
  assert.equal(hasPendingInvitations({ success: true, invitations: [] }), false);
});

test('hasPendingInvitations: false when the invitations field is missing', () => {
  assert.equal(hasPendingInvitations({ success: true }), false);
});

test('hasPendingInvitations: false on a signed-out/error response, even with an invitations array', () => {
  // A 401 body or any success:false response must never read as "has invitations" —
  // guards against a stale/malformed payload flashing a badge before sign-in state settles.
  assert.equal(
    hasPendingInvitations({ success: false, invitations: [{ id: 'inv-1' }] }),
    false,
  );
});

test('hasPendingInvitations: false for a non-object payload', () => {
  assert.equal(hasPendingInvitations(null), false);
  assert.equal(hasPendingInvitations(undefined), false);
  assert.equal(hasPendingInvitations('nope'), false);
});

test('readCachedInvitationsBadge: fresh cache returns the stored value', () => {
  const storage = fakeStorage();
  const now = 1_000_000;
  writeCachedInvitationsBadge(storage, 'user-1', true, now);
  assert.equal(readCachedInvitationsBadge(storage, 'user-1', now + 1_000), true);
});

test('readCachedInvitationsBadge: expired cache returns null', () => {
  const storage = fakeStorage();
  const now = 1_000_000;
  writeCachedInvitationsBadge(storage, 'user-1', true, now);
  const afterExpiry = now + PENDING_INVITATIONS_TTL_MS + 1;
  assert.equal(readCachedInvitationsBadge(storage, 'user-1', afterExpiry), null);
});

test('readCachedInvitationsBadge: corrupt JSON returns null', () => {
  const storage = fakeStorage({ [PENDING_INVITATIONS_CACHE_KEY]: '{not json' });
  assert.equal(readCachedInvitationsBadge(storage, 'user-1', Date.now()), null);
});

test('readCachedInvitationsBadge: missing cache key returns null', () => {
  const storage = fakeStorage();
  assert.equal(readCachedInvitationsBadge(storage, 'user-1', Date.now()), null);
});

test('readCachedInvitationsBadge: a different user\'s cached entry is not reused', () => {
  // Guards against leaking one signed-in founder's invitation state to the
  // next account that signs in within the same tab session.
  const storage = fakeStorage();
  const now = 1_000_000;
  writeCachedInvitationsBadge(storage, 'user-1', true, now);
  assert.equal(readCachedInvitationsBadge(storage, 'user-2', now + 1), null);
});

test('writeCachedInvitationsBadge: a throwing storage does not throw', () => {
  const storage: PendingInvitationsStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
  assert.doesNotThrow(() => writeCachedInvitationsBadge(storage, 'user-1', true, Date.now()));
});

test('readCachedInvitationsBadge: a throwing storage returns null instead of throwing', () => {
  const storage: PendingInvitationsStorage = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {},
  };
  assert.doesNotThrow(() => {
    assert.equal(readCachedInvitationsBadge(storage, 'user-1', Date.now()), null);
  });
});

test('a corrupt or far-future expiry cannot pin the badge forever', () => {
  const now = 1_000_000;
  const storage = (raw: string) => ({
    getItem: () => raw,
    setItem: () => {},
  });
  // Infinity, or a hand-edited far-future date, would otherwise outlive the tab.
  for (const expiresAt of [Infinity, now + PENDING_INVITATIONS_TTL_MS * 10, Number.MAX_SAFE_INTEGER]) {
    const raw = JSON.stringify({ userId: 'u1', value: true, expiresAt });
    assert.equal(
      readCachedInvitationsBadge(storage(raw), 'u1', now),
      null,
      `expiry ${expiresAt} should be rejected as impossible`,
    );
  }
  // A legitimate entry inside the TTL still reads back.
  const good = JSON.stringify({ userId: 'u1', value: true, expiresAt: now + 1_000 });
  assert.equal(readCachedInvitationsBadge(storage(good), 'u1', now), true);
});

test('a failed request is never cached as "no invitations"', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/components/AppTabBar.tsx'),
    'utf8',
  );
  // Caching a 4xx/5xx as false would hide genuine invitations for the whole
  // TTL, and an account switch must not leave the previous user's badge up
  // while the new user's request is in flight.
  assert.match(source, /response\.ok \? response\.json\(\) : null/);
  assert.match(source, /if \(data === null\) return;/);
  assert.match(source, /setSourcedEventsBadge\(false\);\s*\n\s*\n?\s*const controller = new AbortController\(\);/);
});
