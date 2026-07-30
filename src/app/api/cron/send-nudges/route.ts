import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/admin';
import { sendEmail } from '@/lib/email';
import {
  buildDailyPitchNudgeEmail,
  buildEventDeadlineNudgeEmail,
  buildOrganizerReadinessEmail,
  buildReviewQueueEmail,
  getEventReminderMilestone,
  getLocalDateKey,
  getLocalWeekday,
  getLocalWeekKey,
  shouldSendDailyNudge,
} from '@/lib/nudges';
import { getPracticePrompt } from '@/lib/practice';

export const dynamic = 'force-dynamic';

type NudgeKind =
  | 'daily_pitch_prompt'
  | 'event_deadline_reminder'
  | 'review_assignment_due'
  | 'review_queue_digest'
  | 'organizer_readiness_digest'
  | 'organizer_deadline_alert';

type Candidate = {
  kind: NudgeKind;
  priority: number;
  userId: string;
  email: string;
  subject: string;
  text: string;
  html: string;
  dedupeKey: string;
  goalId?: string | null;
  eventId?: string | null;
};

type ResultRow = {
  kind: NudgeKind;
  userId: string;
  email: string;
  subject: string;
  reason?: string;
};

type ServiceClient = NonNullable<ReturnType<typeof createServiceSupabase>>;

const DEFAULT_TIMEZONE = 'America/New_York';
const DEFAULT_SEND_TIME = '09:00:00';
const DELIVERY_COOLDOWN_HOURS = 20;

function getConfiguredCronSecret() {
  return process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET || '';
}

function authorize(request: NextRequest) {
  const configuredSecret = getConfiguredCronSecret();
  if (!configuredSecret) {
    return { ok: false as const, status: 503, error: 'CRON_SECRET is not configured.' };
  }

  const authHeader = request.headers.get('authorization') || '';
  const headerSecret = request.headers.get('x-cron-secret') || request.headers.get('x-vercel-cron-secret') || '';
  const isAuthorized = authHeader === `Bearer ${configuredSecret}` || headerSecret === configuredSecret;

  if (!isAuthorized) {
    return { ok: false as const, status: 401, error: 'Invalid cron secret.' };
  }

  return { ok: true as const };
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

async function reserveAuditRow(supabase: ServiceClient, candidate: Candidate) {
  const { data, error } = await supabase
    .from('nudge_events')
    .insert({
      user_id: candidate.userId,
      goal_id: candidate.goalId || null,
      event_id: candidate.eventId || null,
      channel: 'email',
      kind: candidate.kind,
      subject: candidate.subject,
      body: candidate.text,
      status: 'queued',
      dedupe_key: candidate.dedupeKey,
      scheduled_for: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (!error) return { inserted: true as const, id: data.id };

  if ((error as { code?: string }).code !== '23505') throw error;

  const { data: retried, error: retryError } = await supabase
    .from('nudge_events')
    .update({
      status: 'queued',
      scheduled_for: new Date().toISOString(),
      sent_at: null,
      error: null,
    })
    .eq('dedupe_key', candidate.dedupeKey)
    .eq('status', 'failed')
    .select('id')
    .maybeSingle();

  if (retryError) throw retryError;
  if (retried?.id) return { inserted: true as const, id: retried.id };
  return { inserted: false as const, duplicate: true as const };
}

async function finalizeAuditRow(
  supabase: ServiceClient,
  id: string,
  updates: { status: 'sent' | 'failed'; sent_at?: string | null; error?: string | null }
) {
  const { error } = await supabase.from('nudge_events').update(updates).eq('id', id);
  if (error) console.error('Cron notification audit update failed:', error);
}

function isDeliveryWindow(now: Date, preference: any) {
  return shouldSendDailyNudge({
    now,
    timeZone: preference?.timezone || DEFAULT_TIMEZONE,
    dailyNudgeTime: preference?.daily_nudge_time || DEFAULT_SEND_TIME,
  });
}

async function runNotificationSweep(request: NextRequest) {
  const auth = authorize(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase service role is not configured.' }, { status: 503 });
  }

  const dryRun = ['1', 'true'].includes(request.nextUrl.searchParams.get('dryRun') || '');
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [goalsResult, eventsResult, assignmentsResult] = await Promise.all([
    supabase
      .from('practice_goals')
      .select('id,user_id,current_prompt_key,created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase
      .from('pitch_events')
      .select('id,organizer_id,name,slug,event_date,submission_deadline,pitch_length_seconds,focus,status')
      .eq('status', 'active')
      .limit(500),
    supabase
      .from('review_assignments')
      .select('id,reviewer_user_id,status,due_at,created_at')
      .in('status', ['pending', 'started'])
      .order('created_at', { ascending: true })
      .limit(2000),
  ]);

  const loadError = goalsResult.error || eventsResult.error || assignmentsResult.error;
  if (loadError) {
    console.error('Notification coordinator base query failed:', loadError);
    return NextResponse.json({ success: false, error: 'Could not load notification inputs.' }, { status: 500 });
  }

  const activeGoals = new Map<string, any>();
  for (const goal of goalsResult.data || []) {
    if (!activeGoals.has(goal.user_id)) activeGoals.set(goal.user_id, goal);
  }

  const events = eventsResult.data || [];
  const eventIds = events.map((event: any) => event.id);
  const [participantsResult, submissionsResult] = await Promise.all([
    eventIds.length
      ? supabase
          .from('pitch_event_participants')
          .select('event_id,user_id,role,status')
          .in('event_id', eventIds)
          .eq('status', 'active')
      : Promise.resolve({ data: [], error: null }),
    eventIds.length
      ? supabase
          .from('pitch_event_submissions')
          .select('event_id,user_id,status')
          .in('event_id', eventIds)
          .in('status', ['submitted', 'locked'])
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (participantsResult.error || submissionsResult.error) {
    console.error('Notification coordinator event query failed:', participantsResult.error || submissionsResult.error);
    return NextResponse.json({ success: false, error: 'Could not load event readiness.' }, { status: 500 });
  }

  const participants = participantsResult.data || [];
  const submissions = submissionsResult.data || [];
  const assignments = assignmentsResult.data || [];
  const participantIds = participants.map((row: any) => row.user_id);
  const reviewerIds = assignments.map((row: any) => row.reviewer_user_id);
  const organizerIds = events.map((event: any) => event.organizer_id).filter(Boolean);
  const userIds = unique([...activeGoals.keys(), ...participantIds, ...reviewerIds, ...organizerIds]);

  const [profilesResult, preferencesResult] = await Promise.all([
    userIds.length
      ? supabase.from('profiles').select('id,email,full_name').in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabase
          .from('notification_preferences')
          .select(
            'user_id,email_enabled,daily_nudge_time,timezone,founder_nudges_enabled,reviewer_digest_enabled,organizer_digest_enabled'
          )
          .in('user_id', userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error || preferencesResult.error) {
    console.error('Notification coordinator user query failed:', profilesResult.error || preferencesResult.error);
    return NextResponse.json({ success: false, error: 'Could not load notification recipients.' }, { status: 500 });
  }

  const profiles = new Map((profilesResult.data || []).map((row: any) => [row.id, row]));
  const preferences = new Map((preferencesResult.data || []).map((row: any) => [row.user_id, row]));
  const submittedPairs = new Set(submissions.map((row: any) => `${row.event_id}:${row.user_id}`));
  const candidates: Candidate[] = [];
  const skipped: ResultRow[] = [];

  const canReceive = (userId: string, roleFlag: string) => {
    const profile = profiles.get(userId);
    const preference = preferences.get(userId);
    return Boolean(
      profile?.email &&
        (preference?.email_enabled ?? true) &&
        (preference?.[roleFlag] ?? true) &&
        isDeliveryWindow(now, preference)
    );
  };

  // Founder event reminders are deadline-driven and outrank daily practice prompts.
  for (const event of events) {
    if (!event.submission_deadline || new Date(event.submission_deadline) > sevenDaysFromNow) continue;
    const milestone = getEventReminderMilestone({ submissionDeadline: event.submission_deadline, now });
    if (!milestone) continue;

    const founders = participants.filter((row: any) => row.event_id === event.id && row.role === 'founder');
    for (const founder of founders) {
      if (submittedPairs.has(`${event.id}:${founder.user_id}`)) continue;
      if (!canReceive(founder.user_id, 'founder_nudges_enabled')) continue;

      const profile = profiles.get(founder.user_id);
      const email = buildEventDeadlineNudgeEmail({
        founderName: profile.full_name,
        eventName: event.name,
        eventSlug: event.slug,
        focusPrompt: getPracticePrompt(event.focus),
        pitchLengthSeconds: event.pitch_length_seconds,
        submissionDeadline: event.submission_deadline,
        eventDate: event.event_date,
      });

      candidates.push({
        kind: 'event_deadline_reminder',
        priority: 2,
        userId: founder.user_id,
        email: profile.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
        eventId: event.id,
        dedupeKey: `founder-event:${event.id}:${founder.user_id}:${milestone}`,
      });
    }
  }

  // Reviewers get immediate due-soon alerts or one Tuesday queue digest.
  const assignmentsByReviewer = new Map<string, any[]>();
  for (const assignment of assignments) {
    const rows = assignmentsByReviewer.get(assignment.reviewer_user_id) || [];
    rows.push(assignment);
    assignmentsByReviewer.set(assignment.reviewer_user_id, rows);
  }

  for (const [reviewerId, rows] of assignmentsByReviewer) {
    if (!canReceive(reviewerId, 'reviewer_digest_enabled')) continue;
    const profile = profiles.get(reviewerId);
    const preference = preferences.get(reviewerId);
    const timezone = preference?.timezone || DEFAULT_TIMEZONE;
    const dueSoon = rows.filter((row) => {
      if (!row.due_at) return false;
      const due = new Date(row.due_at);
      const hours = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hours > 0 && hours <= 24;
    }).length;
    const isTuesday = getLocalWeekday(now, timezone) === 'Tue';
    if (!dueSoon && !isTuesday) continue;

    const email = buildReviewQueueEmail({
      reviewerName: profile.full_name,
      pendingCount: rows.length,
      dueSoonCount: dueSoon,
    });
    const localDate = getLocalDateKey(now, timezone);
    const week = getLocalWeekKey(now, timezone);

    candidates.push({
      kind: dueSoon ? 'review_assignment_due' : 'review_queue_digest',
      priority: dueSoon ? 2 : 3,
      userId: reviewerId,
      email: profile.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
      dedupeKey: dueSoon ? `review-due:${reviewerId}:${localDate}` : `review-digest:${reviewerId}:${week}`,
    });
  }

  // Owners and organizer/admin team members receive exception alerts and a Monday snapshot.
  for (const event of events) {
    const founders = participants.filter((row: any) => row.event_id === event.id && row.role === 'founder');
    if (!founders.length) continue;

    const submissionCount = founders.filter((row: any) => submittedPairs.has(`${event.id}:${row.user_id}`)).length;
    const missingCount = founders.length - submissionCount;
    const milestone = getEventReminderMilestone({ submissionDeadline: event.submission_deadline, now });
    const urgent = missingCount > 0 && (milestone === '72h' || milestone === '24h');
    const teamIds = unique([
      event.organizer_id,
      ...participants
        .filter((row: any) => row.event_id === event.id && ['organizer', 'admin'].includes(row.role))
        .map((row: any) => row.user_id),
    ].filter(Boolean));

    for (const organizerId of teamIds) {
      if (!canReceive(organizerId, 'organizer_digest_enabled')) continue;
      const profile = profiles.get(organizerId);
      const timezone = preferences.get(organizerId)?.timezone || DEFAULT_TIMEZONE;
      const isMonday = getLocalWeekday(now, timezone) === 'Mon';
      if (!urgent && !isMonday) continue;

      const email = buildOrganizerReadinessEmail({
        organizerName: profile.full_name,
        eventName: event.name,
        eventSlug: event.slug,
        founderCount: founders.length,
        submissionCount,
        missingCount,
        submissionDeadline: event.submission_deadline,
        urgent,
      });

      candidates.push({
        kind: urgent ? 'organizer_deadline_alert' : 'organizer_readiness_digest',
        priority: urgent ? 2 : 3,
        userId: organizerId,
        email: profile.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
        eventId: event.id,
        dedupeKey: urgent
          ? `organizer-event:${event.id}:${organizerId}:${milestone}`
          : `organizer-digest:${event.id}:${organizerId}:${getLocalWeekKey(now, timezone)}`,
      });
    }
  }

  for (const goal of activeGoals.values()) {
    if (!canReceive(goal.user_id, 'founder_nudges_enabled')) continue;
    const profile = profiles.get(goal.user_id);
    const timezone = preferences.get(goal.user_id)?.timezone || DEFAULT_TIMEZONE;
    const email = buildDailyPitchNudgeEmail({
      founderName: profile.full_name,
      prompt: getPracticePrompt(goal.current_prompt_key),
    });

    candidates.push({
      kind: 'daily_pitch_prompt',
      priority: 4,
      userId: goal.user_id,
      email: profile.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
      goalId: goal.id,
      dedupeKey: `daily:${goal.user_id}:${getLocalDateKey(now, timezone)}`,
    });
  }

  // One role-aware coordinator chooses the most important message for each person.
  const selectedByUser = new Map<string, Candidate>();
  for (const candidate of candidates.sort((a, b) => a.priority - b.priority)) {
    if (!selectedByUser.has(candidate.userId)) selectedByUser.set(candidate.userId, candidate);
  }

  const selected = [...selectedByUser.values()];
  const cooldownCutoff = new Date(now.getTime() - DELIVERY_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
  const recentResult = selected.length
    ? await supabase
        .from('nudge_events')
        .select('user_id,sent_at')
        .in('user_id', selected.map((candidate) => candidate.userId))
        .eq('status', 'sent')
        .gte('sent_at', cooldownCutoff)
    : { data: [], error: null };

  if (recentResult.error) {
    console.error('Notification cooldown query failed:', recentResult.error);
    return NextResponse.json({ success: false, error: 'Could not enforce notification frequency.' }, { status: 500 });
  }

  const recentlyEmailed = new Set((recentResult.data || []).map((row: any) => row.user_id));
  const sent: ResultRow[] = [];
  const failed: ResultRow[] = [];

  for (const candidate of selected) {
    if (recentlyEmailed.has(candidate.userId)) {
      skipped.push({
        kind: candidate.kind,
        userId: candidate.userId,
        email: candidate.email,
        subject: candidate.subject,
        reason: `A nontransactional email was sent within the last ${DELIVERY_COOLDOWN_HOURS} hours.`,
      });
      continue;
    }

    if (dryRun) {
      sent.push({
        kind: candidate.kind,
        userId: candidate.userId,
        email: candidate.email,
        subject: candidate.subject,
      });
      continue;
    }

    let auditId: string | null = null;
    try {
      const reservation = await reserveAuditRow(supabase, candidate);
      if (!reservation.inserted) {
        skipped.push({
          kind: candidate.kind,
          userId: candidate.userId,
          email: candidate.email,
          subject: candidate.subject,
          reason: 'This notification was already logged for its delivery window.',
        });
        continue;
      }

      auditId = reservation.id;
      const result = await sendEmail({
        to: candidate.email,
        subject: candidate.subject,
        text: candidate.text,
        html: candidate.html,
      });

      if (!result.ok) {
        await finalizeAuditRow(supabase, reservation.id, { status: 'failed', error: result.error });
        failed.push({
          kind: candidate.kind,
          userId: candidate.userId,
          email: candidate.email,
          subject: candidate.subject,
          reason: result.error,
        });
        continue;
      }

      await finalizeAuditRow(supabase, reservation.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
        error: null,
      });
      sent.push({
        kind: candidate.kind,
        userId: candidate.userId,
        email: candidate.email,
        subject: candidate.subject,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown notification delivery error.';
      if (auditId) await finalizeAuditRow(supabase, auditId, { status: 'failed', error: message });
      failed.push({
        kind: candidate.kind,
        userId: candidate.userId,
        email: candidate.email,
        subject: candidate.subject,
        reason: message,
      });
    }
  }

  const counts = Object.fromEntries(
    [...new Set(sent.map((row) => row.kind))].map((kind) => [kind, sent.filter((row) => row.kind === kind).length])
  );

  return NextResponse.json({
    success: true,
    dryRun,
    summary: {
      activeGoals: activeGoals.size,
      activeEvents: events.length,
      pendingReviews: assignments.length,
      candidates: candidates.length,
      selected: selected.length,
      sent: sent.length,
      skipped: skipped.length,
      failed: failed.length,
      byKind: counts,
    },
    sent,
    skipped,
    failed,
  });
}

export async function GET(request: NextRequest) {
  return runNotificationSweep(request);
}

export async function POST(request: NextRequest) {
  return runNotificationSweep(request);
}
