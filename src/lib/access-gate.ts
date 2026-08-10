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
