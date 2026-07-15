const AUTH_PENDING_KEY = "pip.auth-pending";
const AUTH_PENDING_TTL_MS = 15 * 60 * 1000;

type AuthPendingPayload = {
  ts: number;
};

function readPayload(): AuthPendingPayload | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(AUTH_PENDING_KEY);
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as AuthPendingPayload;
    if (!payload?.ts || Date.now() - payload.ts > AUTH_PENDING_TTL_MS) {
      window.localStorage.removeItem(AUTH_PENDING_KEY);
      return null;
    }

    return payload;
  } catch {
    window.localStorage.removeItem(AUTH_PENDING_KEY);
    return null;
  }
}

export function markAuthPending(): void {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(AUTH_PENDING_KEY, JSON.stringify({ ts: Date.now() }));
}

export function readAuthPending(): boolean {
  return readPayload() !== null;
}

export function clearAuthPending(): void {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(AUTH_PENDING_KEY);
}
