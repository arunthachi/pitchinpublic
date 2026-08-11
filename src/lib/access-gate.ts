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

/**
 * Reviewer mode may only be adopted from the FIRST access verification.
 * The recording studio renders under `!reviewerMode`, so a background
 * re-check that flipped the mode would unmount an in-progress take.
 */
export function shouldAdoptReviewerMode(hasVerifiedAccessOnce: boolean) {
  return !hasVerifiedAccessOnce;
}

/**
 * Did the reviewer-access lookup give a DEFINITIVE answer about the caller's
 * role?
 *
 * Not the same as "did it succeed". `/api/reviewer/access` answers 403 for a
 * founder with no reviewer membership — the single most common case — so
 * treating only 2xx as resolved would leave every founder unable to open the
 * recorder. Undecided means the session is invalid (401) or the service itself
 * failed (5xx, including the 503 when reviewer storage is unconfigured); a
 * network throw never reaches this predicate and leaves the role unresolved.
 */
export function isRoleResolved(status: number) {
  if (status === 401) return false;
  return status < 500;
}

export type RecorderAccessInput = {
  /** The server has given a definitive answer about the caller's role. */
  roleResolved: boolean;
  /** Caller holds trusted-reviewer membership. */
  reviewerAccess: boolean;
  /** Caller may also act as a founder. */
  founderAccess: boolean;
  /** Current display mode. */
  reviewerMode: boolean;
};

/**
 * May a `?record=1` deep link open the recording studio?
 *
 * Decided from role DATA rather than the display flag alone. `reviewerMode` can
 * legitimately read false for a reviewer-only account — the first check may
 * have 5xx'd, and mode is deliberately never adopted from a later background
 * re-check, because flipping it would unmount an in-progress recording. So the
 * mode flag is a display concern; entitlement is the reviewer/founder pair.
 */
export function canOpenRecorder(input: RecorderAccessInput) {
  if (!input.roleResolved) return false;
  if (input.reviewerMode) return false;
  if (input.reviewerAccess && !input.founderAccess) return false;
  return true;
}
