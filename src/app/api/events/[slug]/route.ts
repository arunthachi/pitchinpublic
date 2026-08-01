import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceSupabase } from '@/lib/admin';
import { canManageEvent, firstEventUpdateIssue, parseEventUpdate } from './_server';

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
  let pitches: any[] = [];
  let participants: any[] = [];
  let invitations: any[] = [];
  let announcements: any[] = [];
  let reviewCoverage = null;
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
          is_best_take,
          roast_count,
          toast_count,
          views_count,
          startup_name,
          one_line_pitch,
          feedback_ask,
          extra_context,
          take_version,
          created_at
        )
      `
      )
      .eq('event_id', event.id)
      .eq('user_id', user.id)
      .maybeSingle();

    userSubmission = submission;

    isTeamMember = event.organizer_id === user.id || (participant?.status === 'active' && TEAM_ROLES.includes(participant.role));
    canManageEvent = event.organizer_id === user.id || (participant?.status === 'active' && MANAGER_ROLES.includes(participant.role));

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
            public_handle,
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
            public_handle,
            website,
            linkedin_url
          ),
          pitch:pitch_id (
            id,
            public_id,
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
            username,
            public_handle
          ),
          accepted_profile:accepted_by (
            id,
            full_name,
            avatar_url,
            username,
            public_handle
          )
        `
        )
        .eq('event_id', event.id)
        .order('created_at', { ascending: false });

      participants = participantRows || [];
      submissions = submissionRows || [];
      invitations = invitationRows || [];

      const { data: assignmentRows } = await supabase
        .from('review_assignments')
        .select('id,pitch_id,status,completed_feedback_id,completed_at')
        .eq('event_id', event.id);

      const { data: qualitySummaryRows } = await supabase
        .rpc('get_event_review_quality_summary', { target_event_id: event.id });
      const qualitySummary = Array.isArray(qualitySummaryRows) ? qualitySummaryRows[0] : qualitySummaryRows;

      const submittedPitchIds = new Set((submissionRows || []).map((row: any) => row.pitch_id).filter(Boolean));
      const completedAssignments = (assignmentRows || []).filter((row: any) => row.status === 'submitted');
      const pitchesWithFeedback = new Set(completedAssignments.map((row: any) => row.pitch_id));
      const firstReviewMinutes = (submissionRows || []).flatMap((row: any) => {
        const submittedAt = new Date(row.submitted_at || 0).getTime();
        const feedbackTimes = completedAssignments
          .filter((item: any) => item.pitch_id === row.pitch_id)
          .map((item: any) => new Date(item.completed_at || 0).getTime())
          .filter((time: number) => Number.isFinite(time) && time >= submittedAt)
          .sort((a: number, b: number) => a - b);
        return submittedAt > 0 && feedbackTimes.length
          ? [(feedbackTimes[0] - submittedAt) / 60000]
          : [];
      });

      reviewCoverage = {
        pitchesSubmitted: submittedPitchIds.size,
        reviewsAssigned: (assignmentRows || []).length,
        reviewsCompleted: completedAssignments.length,
        usefulReviews: Number(qualitySummary?.useful_reviews || 0),
        pitchesWithFeedback: pitchesWithFeedback.size,
        pitchesWithoutFeedback: Math.max(0, submittedPitchIds.size - pitchesWithFeedback.size),
        foundersWithoutUsefulFeedback: Math.max(0, submittedPitchIds.size - Number(qualitySummary?.pitches_with_useful_feedback || 0)),
        completionRate: (assignmentRows || []).length
          ? Math.round((completedAssignments.length / (assignmentRows || []).length) * 100)
          : 0,
        averageTimeToFirstReviewMinutes: firstReviewMinutes.length
          ? Math.round(firstReviewMinutes.reduce((sum: number, value: number) => sum + value, 0) / firstReviewMinutes.length)
          : null,
      };

      const founderIds = (participantRows || [])
        .filter((row: any) => row.role === 'founder')
        .map((row: any) => row.user_id);

      if (founderIds.length) {
        const { data: pitchRows } = await supabase
          .from('pitches')
          .select(
            `
            id,
            public_id,
            user_id,
            hook,
            description,
            startup_name,
            one_line_pitch,
            feedback_ask,
            extra_context,
            take_version,
            version_number,
            is_best_take,
            video_url,
            thumbnail_url,
            duration,
            roast_count,
            toast_count,
            views_count,
            status,
            created_at,
            profile:user_id (
              id,
              full_name,
              avatar_url,
              username,
              public_handle,
              website,
              linkedin_url
            ),
            feedback (
              id,
              type,
              content,
              created_at
            )
          `
          )
          .in('user_id', founderIds)
          .eq('status', 'published')
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        pitches = pitchRows || [];
      }
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
  if (canManageEvent) safeEvent.hasAccessCode = Boolean(safeEvent.access_code);
  delete safeEvent.access_code;

  return NextResponse.json({
    success: true,
    event: safeEvent,
    participation,
    userSubmission,
    participants,
    submissions,
    pitches,
    invitations,
    announcements,
    isOrganizer: Boolean(user && event.organizer_id === user.id),
    isTeamMember,
    canManageEvent,
    reviewCoverage,
  });
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { success: false, error: 'Event editing is unavailable in this environment.' },
      { status: 503 }
    );
  }

  const supabase = createSupabase(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const { data: event, error: eventError } = await supabase
    .from('pitch_events')
    .select('id,organizer_id,event_date,submission_deadline')
    .eq('slug', params.slug)
    .maybeSingle();

  if (eventError || !event) {
    return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  }

  let participantRole: string | null = null;
  let participantStatus: string | null = null;
  if (event.organizer_id !== user.id) {
    const { data: participant, error: participantError } = await supabase
      .from('pitch_event_participants')
      .select('role,status')
      .eq('event_id', event.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (participantError) {
      console.error('Event manager authorization lookup failed:', participantError);
      return NextResponse.json(
        { success: false, error: 'Could not verify event editing access.' },
        { status: 500 }
      );
    }

    participantRole = participant?.role || null;
    participantStatus = participant?.status || null;
  }

  const isOwner = event.organizer_id === user.id;
  if (
    !canManageEvent({
      userId: user.id,
      organizerId: event.organizer_id,
      participantRole,
      participantStatus,
    })
  ) {
    return NextResponse.json(
      { success: false, error: 'Only event organizers and admins can edit this room.' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = parseEventUpdate(body, event);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: firstEventUpdateIssue(parsed.issues),
        issues: parsed.issues,
      },
      { status: 400 }
    );
  }

  const updateClient = isOwner ? supabase : createServiceSupabase();
  if (!updateClient) {
    return NextResponse.json(
      { success: false, error: 'Event editing is unavailable in this environment.' },
      { status: 503 }
    );
  }

  const { data: updatedEvent, error: updateError } = await updateClient
    .from('pitch_events')
    .update(parsed.update)
    .eq('id', event.id)
    .eq('slug', params.slug)
    .select('*')
    .single();

  if (updateError || !updatedEvent) {
    console.error('Event update failed:', updateError);
    return NextResponse.json(
      { success: false, error: 'Could not save event changes. Please try again.' },
      { status: 500 }
    );
  }

  const safeEvent = { ...updatedEvent };
  safeEvent.hasAccessCode = Boolean(safeEvent.access_code);
  delete safeEvent.access_code;

  return NextResponse.json({ success: true, event: safeEvent });
}
