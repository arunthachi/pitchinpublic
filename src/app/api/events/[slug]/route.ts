import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getInvitationHealth, publicInviteDeliveryError } from '@/lib/event-dashboard';
import { createServiceSupabase } from '@/lib/admin';
import {
  attachFeedbackAvailability,
  availableFeedback,
  resolveFeedbackQuery,
} from '@/lib/feedback-enrichment';
import { isDeckIndicatorEligible, toDeckSummary } from '@/lib/pitch-deck';
import { canManageEvent, firstEventUpdateIssue, parseEventUpdate } from './_server';
import { applySignedUrls, signPrivateRows } from '@/lib/video-providers/sign-rows';

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
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) {
    console.error('Event viewer authentication lookup failed:', authError);
    return NextResponse.json({ success: false, error: 'Could not load the event room.' }, { status: 500 });
  }

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
    const { data: privateEvent, error: privateEventError } = await adminSupabase
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

    if (privateEventError) {
      console.error('Private event invite lookup failed:', privateEventError);
      return NextResponse.json({ success: false, error: 'Could not verify the private event.' }, { status: 500 });
    }

    if (privateEvent) {
      const { data: invitation, error: invitationError } = await adminSupabase
        .from('pitch_event_invitations')
        .select('email,role,status,accepted_by,expires_at')
        .eq('event_id', privateEvent.id)
        .eq('invite_code', inviteCode)
        .maybeSingle();

      if (invitationError) {
        console.error('Private event invitation lookup failed:', invitationError);
        return NextResponse.json({ success: false, error: 'Could not verify the event invitation.' }, { status: 500 });
      }

      if (invitation) {
        event = privateEvent;
        error = null;
        resolvedInvitation = invitation;
      }
    }
  }

  if (error && error.code !== 'PGRST116') {
    console.error('Event room lookup failed:', error);
    return NextResponse.json({ success: false, error: 'Could not load the event room.' }, { status: 500 });
  }

  if (!event) {
    return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  }

  if (inviteCode && adminSupabase && !resolvedInvitation) {
    const { data: invitation, error: invitationError } = await adminSupabase
      .from('pitch_event_invitations')
      .select('email,role,status,accepted_by,expires_at')
      .eq('event_id', event.id)
      .eq('invite_code', inviteCode)
      .maybeSingle();

    if (invitationError) {
      console.error('Event invitation lookup failed:', invitationError);
      return NextResponse.json({ success: false, error: 'Could not verify the event invitation.' }, { status: 500 });
    }

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
  let feedbackEnrichment = availableFeedback<any>();

  if (user) {
    const { data: participant, error: participantError } = await supabase
      .from('pitch_event_participants')
      .select('*')
      .eq('event_id', event.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (participantError) {
      console.error('Event participation lookup failed:', participantError);
      return NextResponse.json({ success: false, error: 'Could not load event participation.' }, { status: 500 });
    }

    participation = participant;

    const { data: submission, error: submissionError } = await supabase
      .from('pitch_event_submissions')
      .select(
        `
        *,
        pitch:pitch_id (
          id,
          hook,
          description,
          video_id,
          visibility,
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

    if (submissionError) {
      console.error('Event submission lookup failed:', submissionError);
      return NextResponse.json({ success: false, error: 'Could not load the event submission.' }, { status: 500 });
    }

    userSubmission = submission;

    isTeamMember = event.organizer_id === user.id || (participant?.status === 'active' && TEAM_ROLES.includes(participant.role));
    canManageEvent = event.organizer_id === user.id || (participant?.status === 'active' && MANAGER_ROLES.includes(participant.role));

    if (isTeamMember) {
      const { data: participantRows, error: participantRowsError } = await supabase
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

      if (participantRowsError) {
        console.error('Event participant list failed:', participantRowsError);
        return NextResponse.json({ success: false, error: 'Could not load event participants.' }, { status: 500 });
      }
      if (!Array.isArray(participantRows)) {
        console.error('Event participant list returned no rows without an error.');
        return NextResponse.json({ success: false, error: 'Could not load event participants.' }, { status: 500 });
      }

      const { data: submissionRows, error: submissionRowsError } = await supabase
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
            video_id,
            visibility,
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
        .order('submitted_at', { ascending: false });

      if (submissionRowsError) {
        console.error('Event submission list failed:', submissionRowsError);
        return NextResponse.json({ success: false, error: 'Could not load event submissions.' }, { status: 500 });
      }
      if (!Array.isArray(submissionRows)) {
        console.error('Event submission list returned no rows without an error.');
        return NextResponse.json({ success: false, error: 'Could not load event submissions.' }, { status: 500 });
      }

      const { data: invitationRows, error: invitationRowsError } = await supabase
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

      if (invitationRowsError) {
        console.error('Event invitation list failed:', invitationRowsError);
        return NextResponse.json({ success: false, error: 'Could not load event invitations.' }, { status: 500 });
      }
      if (!Array.isArray(invitationRows)) {
        console.error('Event invitation list returned no rows without an error.');
        return NextResponse.json({ success: false, error: 'Could not load event invitations.' }, { status: 500 });
      }

      participants = participantRows;

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

      submissions = submissionRows;
      invitations = invitationRows.map((invitation: any) => {
        const { invite_code: inviteCode, ...safeInvitation } = invitation;
        return {
          ...safeInvitation,
          invite_url: `${request.nextUrl.origin}/events/${event.slug}?invite=${encodeURIComponent(inviteCode)}`,
          email_error: publicInviteDeliveryError(invitation.email_status),
          health: getInvitationHealth(invitation),
        };
      });

      const { data: assignmentRows, error: assignmentRowsError } = await supabase
        .rpc('get_event_review_assignments', { target_event_id: event.id });

      if (assignmentRowsError) {
        console.error('Event review assignments failed:', assignmentRowsError);
        return NextResponse.json({ success: false, error: 'Could not load event review assignments.' }, { status: 500 });
      }
      if (!Array.isArray(assignmentRows)) {
        console.error('Event review assignments returned no rows without an error.');
        return NextResponse.json({ success: false, error: 'Could not load event review assignments.' }, { status: 500 });
      }

      completedFeedbackIds = new Set(
        assignmentRows
          .filter((row: any) => row.status === 'submitted' && row.completed_feedback_id)
          .map((row: any) => row.completed_feedback_id),
      );
      const { data: qualitySummaryRows, error: qualitySummaryError } = await supabase
        .rpc('get_event_review_quality_summary', { target_event_id: event.id });
      if (qualitySummaryError) {
        console.error('Event review quality summary failed:', qualitySummaryError);
        return NextResponse.json({ success: false, error: 'Could not load event review quality.' }, { status: 500 });
      }
      if (qualitySummaryRows == null) {
        console.error('Event review quality summary returned no data without an error.');
        return NextResponse.json({ success: false, error: 'Could not load event review quality.' }, { status: 500 });
      }
      const qualitySummary = Array.isArray(qualitySummaryRows) ? qualitySummaryRows[0] : qualitySummaryRows;

      const submittedPitchIds = new Set(submissionRows.map((row: any) => row.pitch_id).filter(Boolean));
      // Coverage measures the ORGANIZER'S review programme. Peer feedback is a
      // welcome extra, but counting it here would let cohort chatter satisfy a
      // "3 reviews per pitch" target and stop an organizer chasing their
      // judges. Reported separately below instead.
      const isPeerReview = (row: any) => row.assignment_reason === 'cohort_peer_feedback';
      const programmeAssignments = assignmentRows.filter((row: any) => !isPeerReview(row));
      const peerAssignments = assignmentRows.filter(isPeerReview);
      const completedAssignments = programmeAssignments.filter((row: any) => row.status === 'submitted');
      const completedPeerReviews = peerAssignments.filter((row: any) => row.status === 'submitted');
      const pitchesWithFeedback = new Set(completedAssignments.map((row: any) => row.pitch_id));
      const firstReviewMinutes = submissionRows.flatMap((row: any) => {
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
        reviewsAssigned: programmeAssignments.length,
        reviewsCompleted: completedAssignments.length,
        usefulReviews: Number(qualitySummary?.useful_reviews || 0),
        pitchesWithFeedback: pitchesWithFeedback.size,
        pitchesWithoutFeedback: Math.max(0, submittedPitchIds.size - pitchesWithFeedback.size),
        foundersWithoutUsefulFeedback: Math.max(0, submittedPitchIds.size - Number(qualitySummary?.pitches_with_useful_feedback || 0)),
        peerReviewsCompleted: completedPeerReviews.length,
        pitchesWithPeerFeedback: new Set(completedPeerReviews.map((row: any) => row.pitch_id)).size,
        completionRate: programmeAssignments.length
          ? Math.round((completedAssignments.length / programmeAssignments.length) * 100)
          : 0,
        averageTimeToFirstReviewMinutes: firstReviewMinutes.length
          ? Math.round(firstReviewMinutes.reduce((sum: number, value: number) => sum + value, 0) / firstReviewMinutes.length)
          : null,
      };

      const founderIds = participantRows
        .filter((row: any) => row.role === 'founder')
        .map((row: any) => row.user_id);

      if (founderIds.length) {
        const { data: pitchRows, error: pitchRowsError } = await supabase
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
            video_id,
            visibility,
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
            )
          `
          )
          .in('user_id', founderIds)
          .eq('status', 'published')
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (pitchRowsError) {
          console.error('Event pitch list failed:', pitchRowsError);
          return NextResponse.json({ success: false, error: 'Could not load event pitches.' }, { status: 500 });
        }
        if (!Array.isArray(pitchRows)) {
          console.error('Event pitch list returned no rows without an error.');
          return NextResponse.json({ success: false, error: 'Could not load event pitches.' }, { status: 500 });
        }

        pitches = pitchRows;
      }

      const embeddedPitch = (row: any) => (Array.isArray(row?.pitch) ? row.pitch[0] : row?.pitch);
      const pitchIds = [...new Set([
        ...submissionRows.map((row: any) => embeddedPitch(row)?.id),
        ...pitches.map((pitch: any) => pitch.id),
      ].filter(Boolean))] as string[];
      const feedbackResult = pitchIds.length && completedFeedbackIds.size
        ? await supabase.rpc('get_founder_pitch_feedback', { target_pitch_ids: pitchIds })
        : { data: [], error: null };
      feedbackEnrichment = resolveFeedbackQuery<any>({
        data: Array.isArray(feedbackResult.data)
          ? feedbackResult.data.filter((feedback: any) => completedFeedbackIds.has(feedback.id))
          : feedbackResult.data as any[] | null,
        error: feedbackResult.error,
      });
      if (feedbackEnrichment.feedbackState === 'unavailable') {
        console.error('Event feedback enrichment failed; returning base event pitches:', feedbackEnrichment.error);
      }

      const attachEventFeedback = (pitch: any) =>
        attachFeedbackAvailability(pitch, feedbackEnrichment, (feedback: any) => ({
          id: feedback.id,
          type: feedback.type,
          content: feedback.content,
          author_name: feedback.reviewer_label || 'Reviewer',
          author: feedback.profiles || undefined,
          reviewer_role: feedback.reviewer_role,
          reviewer_badge: feedback.reviewer_badge || null,
          created_at: feedback.created_at,
        }));
      const attachSubmissionFeedback = (row: any) => {
        if (!row?.pitch) return row;
        if (Array.isArray(row.pitch)) {
          return { ...row, pitch: row.pitch.map((pitch: any) => pitch ? attachEventFeedback(pitch) : pitch) };
        }
        return { ...row, pitch: attachEventFeedback(row.pitch) };
      };
      submissions = submissionRows.map(attachSubmissionFeedback);
      pitches = pitches.map(attachEventFeedback);
    }

    if (participation || isTeamMember) {
      const { data: announcementRows, error: announcementRowsError } = await supabase
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

      if (announcementRowsError) {
        console.error('Event announcement list failed:', announcementRowsError);
        return NextResponse.json({ success: false, error: 'Could not load event announcements.' }, { status: 500 });
      }
      if (!Array.isArray(announcementRows)) {
        console.error('Event announcement list returned no rows without an error.');
        return NextResponse.json({ success: false, error: 'Could not load event announcements.' }, { status: 500 });
      }

      announcements = announcementRows;
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

  // Event surfaces carry private takes by definition, so sign them here too.
  // Done once over everything the payload exposes rather than per query, so a
  // future select cannot quietly ship an unsigned private URL.
  const submissionPitch = (row: any) => (Array.isArray(row?.pitch) ? row.pitch[0] : row?.pitch);
  const eventPitchRows = [
    ...pitches,
    ...submissions.map(submissionPitch),
    // The founder's own submission is private by definition and was being
    // returned raw alongside the signed copies.
    submissionPitch(userSubmission),
  ].filter(Boolean);
  const signedEventUrls = await signPrivateRows(eventPitchRows as any[]);
  const signedPitches = pitches.map((row: any) => applySignedUrls(row, signedEventUrls));
  // Preserve the original shape: Supabase returns an array for some embeds and
  // an object for others, and every element must survive.
  const signSubmissionRow = (row: any) => {
    if (!row?.pitch) return row;
    if (Array.isArray(row.pitch)) {
      return { ...row, pitch: row.pitch.map((p: any) => (p ? applySignedUrls(p, signedEventUrls) : p)) };
    }
    return { ...row, pitch: applySignedUrls(row.pitch, signedEventUrls) };
  };
  const signedSubmissions = submissions.map(signSubmissionRow);
  const signedUserSubmission = userSubmission ? signSubmissionRow(userSubmission) : userSubmission;

  return NextResponse.json({
    success: true,
    event: safeEvent,
    participation,
    userSubmission: signedUserSubmission,
    participants,
    submissions: signedSubmissions,
    pitches: signedPitches,
    feedbackState: feedbackEnrichment.feedbackState,
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
