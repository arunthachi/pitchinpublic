export function isAllowedPilotAdmin(email?: string | null) {
  const raw = process.env.PILOT_ADMIN_EMAILS || process.env.NEXT_PUBLIC_PILOT_ADMIN_EMAILS || '';
  const allowlist = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (!allowlist.length || !email) return false;
  return allowlist.includes(email.toLowerCase());
}
