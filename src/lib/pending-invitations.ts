/**
 * Backs the routed tab bar's invitation badge (see `AppTabBar`).
 *
 * `/api/events` runs an auth check plus joined Supabase queries — it is not
 * cheap, and `AppTabBar` mounts fresh on every routed page (/events,
 * /events/[slug], /profile/[userId], /pitch/[id]). Without caching, tapping
 * between those pages would fire the request on every navigation. A pending
 * invitation is created rarely (an organizer inviting a founder) and is not
 * something a founder is expected to act on within seconds of it happening,
 * so a short-lived cached answer is an acceptable trade for turning N route
 * mounts into at most one request per TTL window.
 */

export const PENDING_INVITATIONS_CACHE_KEY = 'pip.pendingInvitations.v1';

/** See the module doc: staleness up to a minute is an acceptable trade here. */
export const PENDING_INVITATIONS_TTL_MS = 60_000;

export type PendingInvitationsStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

type CachedInvitationsEntry = {
  userId: string;
  value: boolean;
  expiresAt: number;
};

/**
 * Decodes the `/api/events` response the same way the home ribbon does
 * (`app/page.tsx`: `Boolean(data.invitations?.length)`), but also requires
 * `success` so a 401/error body (signed-out, session expired) never reads as
 * "has invitations".
 */
export function hasPendingInvitations(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const data = payload as { success?: unknown; invitations?: unknown };
  if (data.success !== true) return false;
  return Array.isArray(data.invitations) && data.invitations.length > 0;
}

function isFreshEntry(
  candidate: unknown,
  userId: string,
  now: number,
): candidate is CachedInvitationsEntry {
  if (!candidate || typeof candidate !== 'object') return false;
  const entry = candidate as Partial<CachedInvitationsEntry>;
  return (
    entry.userId === userId &&
    typeof entry.value === 'boolean' &&
    typeof entry.expiresAt === 'number' &&
    entry.expiresAt > now
  );
}

/**
 * Reads the cached badge state for `userId`. Returns null on a cache miss,
 * an expired entry, corrupt JSON, or an entry scoped to a different user
 * (e.g. someone signed out and back in as another account in the same tab) —
 * every case that should fall through to a fresh fetch rather than a stale
 * or leaked answer.
 */
export function readCachedInvitationsBadge(
  storage: PendingInvitationsStorage,
  userId: string,
  now: number,
): boolean | null {
  let raw: string | null;
  try {
    raw = storage.getItem(PENDING_INVITATIONS_CACHE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  return isFreshEntry(parsed, userId, now) ? parsed.value : null;
}

/** Writes the badge state for `userId`, expiring after PENDING_INVITATIONS_TTL_MS. */
export function writeCachedInvitationsBadge(
  storage: PendingInvitationsStorage,
  userId: string,
  value: boolean,
  now: number,
): void {
  const entry: CachedInvitationsEntry = { userId, value, expiresAt: now + PENDING_INVITATIONS_TTL_MS };
  try {
    storage.setItem(PENDING_INVITATIONS_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Private-mode storage denial or a full quota just means the next mount
    // fetches again — never worth surfacing on chrome as small as a tab dot.
  }
}

/** Guards the `window.sessionStorage` access itself, which can throw independently of getItem/setItem. */
export function getBrowserInvitationsStorage(): PendingInvitationsStorage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
