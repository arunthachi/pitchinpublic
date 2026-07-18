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

function parseEventInvitePath(nextPath?: string | null) {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) return null;

  try {
    const url = new URL(nextPath, 'https://pitchinpublic.local');
    const match = url.pathname.match(/^\/events\/([^/]+)$/);
    const inviteCode = url.searchParams.get('invite')?.trim();

    if (!match || !inviteCode || inviteCode.length > 64) return null;

    return {
      slug: decodeURIComponent(match[1]),
      inviteCode,
    };
  } catch {
    return null;
  }
}

/**
 * A pending event invite may open the auth gate only for its exact event URL.
 * Addressed invites remain bound to that email; link-only invites are one-time
 * bearer credentials and are bound to an email when the founder accepts them.
 */
export async function isValidPilotInvitePath(nextPath?: string | null, email?: string | null) {
  const invitePath = parseEventInvitePath(nextPath);
  if (!invitePath) return false;

  const adminSupabase = createServiceSupabase();
  if (!adminSupabase) return false;

  const { data: event, error: eventError } = await adminSupabase
    .from('pitch_events')
    .select('id')
    .eq('slug', invitePath.slug)
    .in('status', ['draft', 'active'])
    .maybeSingle();

  if (eventError) {
    console.error('Pilot access invite event lookup failed:', eventError);
  }

  if (!event) return false;

  const { data: invitation, error: invitationError } = await adminSupabase
    .from('pitch_event_invitations')
    .select('email')
    .eq('event_id', event.id)
    .eq('invite_code', invitePath.inviteCode)
    .eq('status', 'pending')
    .maybeSingle();

  if (invitationError) {
    console.error('Pilot access invite path lookup failed:', invitationError);
    return false;
  }

  if (!invitation) return false;

  const normalizedInviteEmail = normalizeEmail(invitation.email);
  const normalizedEmail = normalizeEmail(email);
  return !normalizedInviteEmail || normalizedInviteEmail === normalizedEmail;
}

export async function isEmailAllowedForPilot(email?: string | null, nextPath?: string | null) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;

  if (await isValidPilotInvitePath(nextPath, normalizedEmail)) {
    return true;
  }

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

export async function isUserAllowedForPilot(user?: User | null, nextPath?: string | null) {
  return isEmailAllowedForPilot(user?.email, nextPath);
}
