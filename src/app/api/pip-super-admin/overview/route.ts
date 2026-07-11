import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const admin = await requirePlatformAdmin(request);

  if (!admin.ok) {
    return NextResponse.json({ success: false, error: admin.error }, { status: admin.status });
  }

  const supabase = admin.adminSupabase;

  const [
    profilesResult,
    organizersResult,
    invitationsResult,
    eventsResult,
    leadsResult,
    pendingInvitesResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,email,full_name,avatar_url,created_at,pitches_count,companies_count', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('profile_roles')
      .select('user_id,created_at,profiles:user_id(id,email,full_name,avatar_url,created_at,pitches_count,companies_count)', { count: 'exact' })
      .eq('role', 'organizer')
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('organizer_invitations')
      .select('id,email,organization_name,website,invite_code,status,email_status,email_error,email_sent_at,created_at,expires_at,accepted_at,accepted_by')
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('pitch_events')
      .select('id,name,slug,status,event_date,organizer_id,created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('lead_requests')
      .select('id,type,email,name,website,notification_status,created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('organizer_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ]);

  const errors = [
    profilesResult.error,
    organizersResult.error,
    invitationsResult.error,
    eventsResult.error,
    leadsResult.error,
    pendingInvitesResult.error,
  ].filter(Boolean);

  if (errors.length) {
    console.error('Admin overview failed:', errors);
    return NextResponse.json({ success: false, error: 'Could not load platform admin dashboard.' }, { status: 500 });
  }

  const organizers = (organizersResult.data || []).map((row: any) => ({
    roleCreatedAt: row.created_at,
    ...(Array.isArray(row.profiles) ? row.profiles[0] : row.profiles),
  }));

  return NextResponse.json({
    success: true,
    counts: {
      founders: profilesResult.count || 0,
      organizers: organizersResult.count || organizers.length,
      events: eventsResult.count || 0,
      pendingOrganizerInvites: pendingInvitesResult.count || 0,
    },
    founders: profilesResult.data || [],
    organizers,
    organizerInvitations: invitationsResult.data || [],
    events: eventsResult.data || [],
    leads: leadsResult.data || [],
  });
}
