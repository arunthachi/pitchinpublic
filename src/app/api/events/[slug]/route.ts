import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getInvitationHealth, publicInviteDeliveryError, scopePitchFeedbackToEvent } from '@/lib/event-dashboard';
import { createServiceSupabase } from '@/lib/admin';
import { isDeckIndicatorEligible, toDeckSummary } from '@/lib/pitch-deck';
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
  const inviteCode = (request.nextUrl.searchParams.get('invite') || request.nextUrl.searchParams.get('code') || '').trim();

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

  let { data: event, error } = await supabase
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

  let resolvedInvitation: any = null;
  const adminSupabase = inviteCode ? createServiceSupabase() : null;

  // Private rooms are hidden by RLS before membership exists. A valid bearer
  // invite may reveal the room landing page, but never grants membership by
  // itself; POST /join performs the authenticated acceptance checks.
  if ((!event || error) && inviteCode && adminSupabase) {
    const { data: privateEvent } = await adminSupabase
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
      .maybeSingle();

    if (privateEvent) {
      const { data: invitation } = await adminSupabase
        .from('pitch_event_invitations')
        .select('email,role,status,accepted_by,expires_at')
        .eq('event_id', privateEvent.id)
        .eq('invite_code', inviteCode)
        .maybeSingle();

      if (invitation) {
        event = privateEvent;
        error = null;
        resolvedInvitation = invitation;
      }
    }
  }

  if (error || !event) {
    return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  }

  if (inviteCode && adminSupabase && !resolvedInvitation) {
    const { data: invitation } = await adminSupabase
      .from('pitch_event_invitations')
      .select('email,role,status,accepted_by,expires_at')
      .eq('event_id', event.id)
      .eq('invite_code', inviteCode)
      .maybeSingle();

    resolvedInvitation = invitation;
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
  let completedFeedbackIds = new Set<string>();

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

      // Lightweight per-founder deck indicator for the team dashboard. Only
      // kind and display name travel here; the actual URL is signed on demand
      // by /api/events/[slug]/decks/[userId].
      // Mirror canViewDeck's owner-eligibility rule: only ACTIVE founder
      // participants' decks are ever indicated, so the dashboard never leaks
      // metadata for founders the deck route would refuse to serve.
      const participantUserIds = participants
        .filter((row: any) => isDeckIndicatorEligible(row))
        .map((row: any) => row.user_id)
        .filter(Boolean);
      if (participantUserIds.length) {
        const serviceSupabase = createServiceSupabase();
        if (serviceSupabase) {
          // Scope decks through each founder's ACTIVE startup (earliest active
          // company wins, matching the owner routes) so stale companies' decks
          // never surface.
          const { data: companyRows, error: companyRowsError } = await serviceSupabase
            .from('companies')
            .select('id, founder_id')
            .in('founder_id', participantUserIds)
            .eq('status', 'active')
            .order('created_at', { ascending: true });
          if (companyRowsError) {
            console.error('Event deck company lookup failed:', companyRowsError);
          } else if (companyRows?.length) {
            const companyByFounder = new Map<string, string>();
            for (const row of companyRows) {
              if (!companyByFounder.has(row.founder_id)) companyByFounder.set(row.founder_id, row.id);
            }
            const { data: deckRows, error: deckRowsError } = await serviceSupabase
              .from('startup_decks')
              .select('company_id, kind, file_name, link_url, updated_at')
              .in('company_id', [...companyByFounder.values()]);
            if (deckRowsError) {
              console.error('Event deck indicators failed:', deckRowsError);
            } else if (deckRows?.length) {
              const deckByCompany = new Map(deckRows.map((row: any) => [row.company_id, toDeckSummary(row)]));
              participants = participants.map((row: any) => {
                const companyId = companyByFounder.get(row.user_id);
                return { ...row, deck: (companyId && deckByCompany.get(companyId)) || null };
              });
            }
          }
        }
      }

      submissions = submissionRows || [];
      invitations = (invitationRows || []).map((invitation: any) => {
        const { invite_code: inviteCode, ...safeInvitation } = invitation;
        return {
          ...safeInvitation,
          invite_url: `${request.nextUrl.origin}/events/${event.slug}?invite=${encodeURIComponent(inviteCode)}`,
          email_error: publicInviteDeliveryError(invitation.email_status),
          health: getInvitationHealth(invitation),
        };
      });

      const { data: assignmentRows } = await supabase
        .rpc('get_event_review_assignments', { target_event_id: event.id });

      completedFeedbackIds = new Set(
        (assignmentRows || [])
          .filter((row: any) => row.status === 'submitted' && row.completed_feedback_id)
          .map((row: any) => row.completed_feedback_id),
      );
      submissions = (submissionRows || []).map((row: any) => ({
        ...row,
        pitch: row.pitch ? scopePitchFeedbackToEvent(row.pitch, completedFeedbackIds) : row.pitch,
      }));

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

        pitches = (pitchRows || []).map((pitch: any) => scopePitchFeedbackToEvent(pitch, completedFeedbackIds));
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

  const safeEvent = isTeamMember
    ? { ...event }
    : {
        name: event.name,
        slug: event.slug,
        description: event.description,
        event_date: event.event_date,
        submission_deadline: event.submission_deadline,
        pitch_length_seconds: event.pitch_length_seconds,
        focus: event.focus,
        visibility: event.visibility,
        status: event.status,
        review_exchange_policy: event.review_exchange_policy,
        review_target: event.review_target,
        pitch_hour_starts_at: event.pitch_hour_starts_at,
        pitch_hour_ends_at: event.pitch_hour_ends_at,
        organizer: event.organizer
          ? {
              full_name: event.organizer.full_name,
              avatar_url: event.organizer.avatar_url,
              username: event.organizer.username,
            }
          : null,
      };
  if (canManageEvent) safeEvent.hasAccessCode = Boolean(event.access_code);
  delete (safeEvent as Record<string, any>).access_code;

  let invite = null;
  if (inviteCode) {
    const expired = Boolean(
      resolvedInvitation?.expires_at &&
        new Date(resolvedInvitation.expires_at).getTime() <= Date.now()
    );
    const acceptedByCurrentUser = Boolean(
      user && resolvedInvitation?.status === 'accepted' && resolvedInvitation.accepted_by === user.id
    );
    const usedByAnotherUser = Boolean(
      resolvedInvitation?.status === 'accepted' &&
        resolvedInvitation.accepted_by &&
        (!user || resolvedInvitation.accepted_by !== user.id)
    );
    const invitedEmail = resolvedInvitation?.email?.trim().toLowerCase() || null;
    const currentEmail = user?.email?.trim().toLowerCase() || null;
    const revoked = resolvedInvitation?.status === 'revoked';
    const allowedStatus = ['pending', 'accepted'].includes(resolvedInvitation?.status);

    invite = {
      supplied: true,
      valid: Boolean(resolvedInvitation && allowedStatus && !expired && !usedByAnotherUser),
      status: !resolvedInvitation
        ? 'invalid'
        : expired
          ? 'expired'
          : revoked
            ? 'revoked'
            : usedByAnotherUser
              ? 'used'
              : resolvedInvitation.status,
      email: invitedEmail,
      role: resolvedInvitation?.role || null,
      matchesCurrentUser: user && invitedEmail ? currentEmail === invitedEmail : null,
      acceptedByCurrentUser,
    };
  }

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
    invite,
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
