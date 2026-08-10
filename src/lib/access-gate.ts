/**
 * Decides when the blocking "Checking your access…" screen may replace the
 * app.
 *
 * It may only do so before access has EVER been confirmed in this session.
 * Supabase republishes a fresh user object on every auth event — token
 * refreshes (roughly hourly) and tab-refocus revalidation — and any
 * re-verification triggered by that must stay invisible: unmounting the tree
 * mid-recording or mid-upload destroys a founder's take.
 */
export type AccessGateInput = {
  loading: boolean;
  isGuest: boolean;
  authPending: boolean;
  accessCheckComplete: boolean;
  /** True once any access verification has succeeded in this session. */
  hasVerifiedAccessOnce: boolean;
};

export function shouldShowAccessGate(input: AccessGateInput): boolean {
  // Signed-out first paint: the sign-in handoff is still resolving.
  if (input.loading && input.isGuest && input.authPending) return true;

  // Signed-in: block only on the very first verification.
  return !input.isGuest && !input.accessCheckComplete && !input.hasVerifiedAccessOnce;
}

/**
 * The access check should re-run when the identity changes, not when the
 * session object is merely republished for the same person.
 */
export function accessCheckKey(userId: string | null | undefined) {
  return userId || '';
}

/** How often access is silently re-verified while a tab stays open. */
export const ACCESS_REVERIFY_INTERVAL_MS = 10 * 60 * 1000;
/** Floor between verifications, so tab-focus flapping cannot storm the API. */
export const ACCESS_REVERIFY_MIN_GAP_MS = 60 * 1000;

/**
 * Access must keep being re-verified while a session stays open — a founder
 * removed from the pilot should lose access without needing to reload. The
 * old code got this for free by re-running on every auth event (at the cost
 * of blanking the app); now it is explicit, silent, and rate-floored.
 */
export function shouldReverifyAccess(input: {
  lastCheckedAt: number | null;
  now: number;
  reason: 'interval' | 'focus';
  minGapMs?: number;
  intervalMs?: number;
}): boolean {
  if (input.lastCheckedAt === null) return false; // the first check owns this
  const elapsed = input.now - input.lastCheckedAt;
  if (elapsed < (input.minGapMs ?? ACCESS_REVERIFY_MIN_GAP_MS)) return false;
  if (input.reason === 'focus') return true;
  return elapsed >= (input.intervalMs ?? ACCESS_REVERIFY_INTERVAL_MS);
}
