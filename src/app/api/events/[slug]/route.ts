import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function createSupabase(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

const TEAM_ROLES = ['organizer', 'admin', 'coach', 'mentor', 'judge'];
const MANAGER_ROLES = ['organizer', 'admin'];

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { success: false, error: 'Event room data is unavailable in this environment.' },
      { status: 503 }
    );
  }

  const supabase = createSupabase(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: event, error } = await supabase
    .from('pitch_events')
    .select(
      `
      *,
      organizer:organizer_id (
        id,
        full_name,
        avatar_url,
        username
      )
    `
    )
    .eq('slug', params.slug)
    .single();

  if (error || !event) {
    return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  }

  let participation = null;
  let userSubmission = null;
  let submissions: any[] = [];
  let participants: any[] = [];
  let invitations: any[] = [];
  let announcements: any[] = [];
  let isTeamMember = false;
  let canManageEvent = false;

  if (user) {
    const { data: participant } = await supabase
      .from('pitch_event_participants')
      .select('*')
      .eq('event_id', event.id)
      .eq('user_id', user.id)
      .maybeSingle();

    participation = participant;

    const { data: submission } = await supabase
      .from('pitch_event_submissions')
      .select(
        `
        *,
        pitch:pitch_id (
          id,
          hook,
          description,
          video_url,
          thumbnail_url,
          duration,
          roast_count,
          toast_count,
          views_count,
          created_at
        )
      `
      )
      .eq('event_id', event.id)
      .eq('user_id', user.id)
      .maybeSingle();

    userSubmission = submission;

    isTeamMember = event.organizer_id === user.id || TEAM_ROLES.includes(participant?.role);
    canManageEvent = event.organizer_id === user.id || MANAGER_ROLES.includes(participant?.role);

    if (isTeamMember) {
      const { data: participantRows } = await supabase
        .from('pitch_event_participants')
        .select(
          `
          *,
          profile:user_id (
            id,
            full_name,
            avatar_url,
            username,
            website,
            linkedin_url
          )
        `
        )
        .eq('event_id', event.id)
        .order('joined_at', { ascending: true });

      const { data: submissionRows } = await supabase
        .from('pitch_event_submissions')
        .select(
          `
          *,
          profile:user_id (
            id,
            full_name,
            avatar_url,
            username,
            website,
            linkedin_url
          ),
          pitch:pitch_id (
            id,
            hook,
            description,
            video_url,
            thumbnail_url,
            duration,
            roast_count,
            toast_count,
            views_count,
            created_at,
            feedback (
              id,
              type,
              content,
              created_at
            )
          )
        `
        )
        .eq('event_id', event.id)
        .order('submitted_at', { ascending: false });

      const { data: invitationRows } = await supabase
        .from('pitch_event_invitations')
        .select(
          `
          *,
          inviter:invited_by (
            id,
            full_name,
            avatar_url,
            username
          ),
          accepted_profile:accepted_by (
            id,
            full_name,
            avatar_url,
            username
          )
        `
        )
        .eq('event_id', event.id)
        .order('created_at', { ascending: false });

      participants = participantRows || [];
      submissions = submissionRows || [];
      invitations = invitationRows || [];
    }

    if (participation || isTeamMember) {
      const { data: announcementRows } = await supabase
        .from('pitch_event_announcements')
        .select(
          `
          *,
          author:author_id (
            id,
            full_name,
            avatar_url,
            username
          )
        `
        )
        .eq('event_id', event.id)
        .order('created_at', { ascending: false })
        .limit(20);

      announcements = announcementRows || [];
    }
  }

  const safeEvent = { ...event };
  delete safeEvent.access_code;

  return NextResponse.json({
    success: true,
    event: safeEvent,
    participation,
    userSubmission,
    participants,
    submissions,
    invitations,
    announcements,
    isOrganizer: Boolean(user && event.organizer_id === user.id),
    isTeamMember,
    canManageEvent,
  });
}
