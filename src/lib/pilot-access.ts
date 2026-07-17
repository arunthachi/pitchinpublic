import type { User } from '@supabase/supabase-js';
import { createServiceSupabase, normalizeEmail } from '@/lib/admin';
export { INVITE_ONLY_MESSAGE } from '@/lib/access-copy';

const splitEmailList = (value?: string | null) =>
  (value || '')
    .split(',')
    .map((item) => normalizeEmail(item))
    .filter(Boolean);

export function getPilotAllowlistEmails() {
  return new Set([
    ...splitEmailList(process.env.PILOT_ALLOWLIST_EMAILS),
    ...splitEmailList(process.env.PLATFORM_ADMIN_EMAILS),
    // Keep the owner account available even if env vars are missing during a deploy.
    'arun@pitchinpublic.io',
  ]);
}

export async function isEmailAllowedForPilot(email?: string | null) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;

  if (getPilotAllowlistEmails().has(normalizedEmail)) {
    return true;
  }

  const adminSupabase = createServiceSupabase();
  if (!adminSupabase) {
    return false;
  }

  const { data: platformAdmin, error: platformAdminError } = await adminSupabase
    .from('platform_admins')
    .select('email')
    .eq('email', normalizedEmail)
    .eq('role', 'super_admin')
    .maybeSingle();

  if (platformAdminError) {
    console.error('Pilot access platform admin lookup failed:', platformAdminError);
  }

  if (platformAdmin) {
    return true;
  }

  const { data: organizerInvite, error: organizerInviteError } = await adminSupabase
    .from('organizer_invitations')
    .select('id,expires_at,status')
    .eq('email', normalizedEmail)
    .in('status', ['pending', 'accepted'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (organizerInviteError) {
    console.error('Pilot access organizer invite lookup failed:', organizerInviteError);
  }

  if (
    organizerInvite &&
    (!organizerInvite.expires_at || new Date(organizerInvite.expires_at).getTime() >= Date.now())
  ) {
    return true;
  }

  const { data: eventInvite, error: eventInviteError } = await adminSupabase
    .from('pitch_event_invitations')
    .select('id,status')
    .eq('email', normalizedEmail)
    .in('status', ['pending', 'accepted'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (eventInviteError) {
    console.error('Pilot access event invite lookup failed:', eventInviteError);
  }

  return Boolean(eventInvite);
}

export async function isUserAllowedForPilot(user?: User | null) {
  return isEmailAllowedForPilot(user?.email);
}
