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
      .select('id,type,email,name,website,source,status,notification_status,notification_error,confirmation_status,confirmation_error,created_at')
      .order('created_at', { ascending: false })
      .limit(100),
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

  const leadRows = leadsResult.data || [];
  const leadTotals = leadRows.reduce(
    (acc: any, lead: any) => {
      const source = (lead.source || 'unknown').trim() || 'unknown';
      acc.total += 1;
      if (lead.type === 'founder') acc.founderRequests += 1;
      if (lead.type === 'organizer') acc.organizerRequests += 1;
      if (lead.status === 'new') acc.newRequests += 1;
      if (lead.status === 'reviewing') acc.reviewingRequests += 1;
      if (lead.status === 'approved') acc.approvedRequests += 1;
      if (lead.status === 'declined') acc.declinedRequests += 1;
      if (lead.confirmation_status === 'sent') acc.confirmationSent += 1;
      if (lead.confirmation_status === 'failed') acc.confirmationFailed += 1;
      if (lead.confirmation_status === 'not_configured') acc.confirmationNotConfigured += 1;
      if (lead.confirmation_status === 'skipped') acc.confirmationSkipped += 1;
      if (lead.notification_status === 'sent') acc.notificationSent += 1;
      if (lead.notification_status === 'failed') acc.notificationFailed += 1;
      if (lead.notification_status === 'not_configured') acc.notificationNotConfigured += 1;
      if (lead.notification_status === 'skipped') acc.notificationSkipped += 1;
      acc.sources.set(source, (acc.sources.get(source) || 0) + 1);
      return acc;
    },
    {
      total: 0,
      founderRequests: 0,
      organizerRequests: 0,
      newRequests: 0,
      reviewingRequests: 0,
      approvedRequests: 0,
      declinedRequests: 0,
      confirmationSent: 0,
      confirmationFailed: 0,
      confirmationNotConfigured: 0,
      confirmationSkipped: 0,
      notificationSent: 0,
      notificationFailed: 0,
      notificationNotConfigured: 0,
      notificationSkipped: 0,
      sources: new Map<string, number>(),
    }
  );

  const topSources = Array.from(leadTotals.sources.entries() as Iterable<[string, number]>)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const leadMetrics = { ...leadTotals };
  delete leadMetrics.sources;

  return NextResponse.json({
    success: true,
    counts: {
      founders: profilesResult.count || 0,
      organizers: organizersResult.count || organizers.length,
      events: eventsResult.count || 0,
      pendingOrganizerInvites: pendingInvitesResult.count || 0,
      leadRequests: leadsResult.count || leadRows.length,
    },
    founders: profilesResult.data || [],
    organizers,
    organizerInvitations: invitationsResult.data || [],
    events: eventsResult.data || [],
    leads: leadRows,
    leadMetrics: {
      ...leadMetrics,
      topSources,
    },
  });
}
