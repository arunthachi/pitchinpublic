import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/admin';
import { sendEmail } from '@/lib/email';
import {
  buildDailyPitchNudgeEmail,
  buildEventDeadlineNudgeEmail,
  getLocalDateKey,
  shouldSendDailyNudge,
  shouldSendEventReminder,
} from '@/lib/nudges';
import { getPracticePrompt } from '@/lib/practice';

export const dynamic = 'force-dynamic';

type NudgeKind = 'daily_pitch_prompt' | 'event_deadline_reminder';

type NudgeAuditStatus = 'queued' | 'sent' | 'skipped' | 'failed';

type CronSummary = {
  kind: NudgeKind;
  userId: string;
  email: string;
  subject: string;
  reason?: string;
};

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

async function reserveAuditRow(
  supabase: NonNullable<ReturnType<typeof createServiceSupabase>>,
  row: {
    user_id: string;
    kind: NudgeKind;
    channel: 'email';
    subject: string;
    body: string;
    status: NudgeAuditStatus;
    goal_id?: string | null;
    event_id?: string | null;
    dedupe_key: string;
    scheduled_for?: string;
    sent_at?: string | null;
    error?: string | null;
  }
) {
  const { data, error } = await supabase
    .from('nudge_events')
    .insert({
      user_id: row.user_id,
      goal_id: row.goal_id || null,
      event_id: row.event_id || null,
      channel: row.channel,
      kind: row.kind,
      subject: row.subject,
      body: row.body,
      status: row.status,
      dedupe_key: row.dedupe_key,
      scheduled_for: row.scheduled_for || new Date().toISOString(),
      sent_at: row.sent_at || null,
      error: row.error || null,
    })
    .select('id')
    .single();

  if (error) {
    if ((error as any)?.code === '23505') {
      return { inserted: false as const, duplicate: true as const };
    }

    throw error;
  }

  return { inserted: true as const, id: data.id };
}

async function finalizeAuditRow(
  supabase: NonNullable<ReturnType<typeof createServiceSupabase>>,
  id: string,
  updates: Partial<{
    status: NudgeAuditStatus;
    sent_at: string | null;
    error: string | null;
  }>
) {
  const { error } = await supabase.from('nudge_events').update(updates).eq('id', id);
  if (error) {
    console.error('Cron nudge audit update failed:', error);
  }
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

async function runNudgeSweep(request: NextRequest) {
  const auth = authorize(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Supabase service role is not configured.' },
      { status: 503 }
    );
  }

  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1' || request.nextUrl.searchParams.get('dryRun') === 'true';
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nowIso = now.toISOString();
  const soonIso = soon.toISOString();

  const [
    goalsResult,
    eventsResult,
  ] = await Promise.all([
    supabase
      .from('practice_goals')
      .select('id,user_id,name,focus,current_prompt_key,target_date,event_id,prompt_started_on,created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    supabase
      .from('pitch_events')
      .select('id,name,slug,event_date,submission_deadline,pitch_length_seconds,focus,status')
      .eq('status', 'active')
      .not('submission_deadline', 'is', null)
      .gte('submission_deadline', nowIso)
      .lte('submission_deadline', soonIso),
  ]);

  if (goalsResult.error) {
    console.error('Cron nudge goal query failed:', goalsResult.error);
    return NextResponse.json({ success: false, error: 'Could not load practice goals.' }, { status: 500 });
  }

  if (eventsResult.error) {
    console.error('Cron nudge event query failed:', eventsResult.error);
    return NextResponse.json({ success: false, error: 'Could not load active events.' }, { status: 500 });
  }

  const activeGoals = new Map<string, any>();
  for (const goal of goalsResult.data || []) {
    if (!activeGoals.has(goal.user_id)) {
      activeGoals.set(goal.user_id, goal);
    }
  }

  const eventRows = (eventsResult.data || []).filter((event: any) => shouldSendEventReminder({ submissionDeadline: event.submission_deadline, now }));
  const eventIds = unique(eventRows.map((event: any) => event.id));

  const participantRowsResult = eventIds.length
    ? await supabase
        .from('pitch_event_participants')
        .select('event_id,user_id,role,status,created_at')
        .in('event_id', eventIds)
        .eq('role', 'founder')
        .eq('status', 'active')
    : { data: [], error: null };

  if (participantRowsResult.error) {
    console.error('Cron nudge participant query failed:', participantRowsResult.error);
    return NextResponse.json({ success: false, error: 'Could not load event participants.' }, { status: 500 });
  }

  const participantRows = participantRowsResult.data || [];
  const participantUserIds = unique(participantRows.map((row: any) => row.user_id));
  const goalUserIds = [...activeGoals.keys()];
  const profileIds = unique([...goalUserIds, ...participantUserIds]);

  const [profilesResult, preferencesResult, submissionsResult] = await Promise.all([
    profileIds.length
      ? supabase.from('profiles').select('id,email,full_name').in('id', profileIds)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length
      ? supabase.from('notification_preferences').select('user_id,email_enabled,daily_nudge_time,timezone').in('user_id', profileIds)
      : Promise.resolve({ data: [], error: null }),
    eventIds.length && participantUserIds.length
      ? supabase.from('pitch_event_submissions').select('event_id,user_id,status').in('event_id', eventIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error) {
    console.error('Cron nudge profile query failed:', profilesResult.error);
    return NextResponse.json({ success: false, error: 'Could not load founder profiles.' }, { status: 500 });
  }

  if (preferencesResult.error) {
    console.error('Cron nudge preference query failed:', preferencesResult.error);
    return NextResponse.json({ success: false, error: 'Could not load notification preferences.' }, { status: 500 });
  }

  if (submissionsResult.error) {
    console.error('Cron nudge submission query failed:', submissionsResult.error);
    return NextResponse.json({ success: false, error: 'Could not load event submissions.' }, { status: 500 });
  }

  const profilesById = new Map((profilesResult.data || []).map((row: any) => [row.id, row]));
  const preferencesByUserId = new Map((preferencesResult.data || []).map((row: any) => [row.user_id, row]));
  const submittedPairs = new Set((submissionsResult.data || []).map((row: any) => `${row.event_id}:${row.user_id}`));
  const eventReminderTargetUsers = new Set<string>();

  for (const event of eventRows) {
    for (const participant of participantRows.filter((row: any) => row.event_id === event.id)) {
      if (!submittedPairs.has(`${event.id}:${participant.user_id}`)) {
        eventReminderTargetUsers.add(participant.user_id);
      }
    }
  }

  const dailyResults: CronSummary[] = [];
  const eventResults: CronSummary[] = [];
  const skippedResults: CronSummary[] = [];
  const failedResults: CronSummary[] = [];

  for (const goal of activeGoals.values()) {
    const profile = profilesById.get(goal.user_id);
    const preferences = preferencesByUserId.get(goal.user_id);
    const emailEnabled = preferences?.email_enabled ?? true;
    const timezone = preferences?.timezone || 'America/New_York';
    const dailyNudgeTime = preferences?.daily_nudge_time || '09:00:00';

    if (!profile?.email) {
      skippedResults.push({
        kind: 'daily_pitch_prompt',
        userId: goal.user_id,
        email: '',
        subject: 'Daily pitch prompt skipped',
        reason: 'No founder email address was found.',
      });
      continue;
    }

    if (!emailEnabled) {
      skippedResults.push({
        kind: 'daily_pitch_prompt',
        userId: goal.user_id,
        email: profile.email,
        subject: 'Daily pitch prompt skipped',
        reason: 'Automated email nudges are disabled.',
      });
      continue;
    }

    if (!shouldSendDailyNudge({ now, timeZone: timezone, dailyNudgeTime })) {
      continue;
    }

    if (eventReminderTargetUsers.has(goal.user_id)) {
      skippedResults.push({
        kind: 'daily_pitch_prompt',
        userId: goal.user_id,
        email: profile.email,
        subject: 'Daily pitch prompt skipped',
        reason: 'An event deadline reminder is more relevant for this founder today.',
      });
      continue;
    }

    const localDateKey = getLocalDateKey(now, timezone);
    const dedupeKey = `daily:${goal.user_id}:${localDateKey}`;
    const prompt = getPracticePrompt(goal.current_prompt_key);
    const email = buildDailyPitchNudgeEmail({
      founderName: profile.full_name,
      prompt,
    });

    if (dryRun) {
      dailyResults.push({
        kind: 'daily_pitch_prompt',
        userId: goal.user_id,
        email: profile.email,
        subject: email.subject,
      });
      continue;
    }

    try {
      const reservation = await reserveAuditRow(supabase, {
        user_id: goal.user_id,
        goal_id: goal.id,
        kind: 'daily_pitch_prompt',
        channel: 'email',
        subject: email.subject,
        body: email.text,
        status: 'queued',
        dedupe_key: dedupeKey,
      });

      if (!reservation.inserted) {
        skippedResults.push({
          kind: 'daily_pitch_prompt',
          userId: goal.user_id,
          email: profile.email,
          subject: email.subject,
          reason: 'A daily nudge was already logged for this founder today.',
        });
        continue;
      }

      const sendResult = await sendEmail({
        to: profile.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });

      if (!sendResult.ok) {
        await finalizeAuditRow(supabase, reservation.id, {
          status: 'failed',
          error: sendResult.error,
        });
        failedResults.push({
          kind: 'daily_pitch_prompt',
          userId: goal.user_id,
          email: profile.email,
          subject: email.subject,
          reason: sendResult.error,
        });
        continue;
      }

      await finalizeAuditRow(supabase, reservation.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
        error: null,
      });

      dailyResults.push({
        kind: 'daily_pitch_prompt',
        userId: goal.user_id,
        email: profile.email,
        subject: email.subject,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error while sending the daily prompt.';
      failedResults.push({
        kind: 'daily_pitch_prompt',
        userId: goal.user_id,
        email: profile.email,
        subject: email.subject,
        reason: message,
      });
    }
  }

  for (const event of eventRows) {
    const prompt = getPracticePrompt(event.focus);

    for (const participant of participantRows.filter((row: any) => row.event_id === event.id)) {
      if (submittedPairs.has(`${event.id}:${participant.user_id}`)) {
        skippedResults.push({
          kind: 'event_deadline_reminder',
          userId: participant.user_id,
          email: profilesById.get(participant.user_id)?.email || '',
          subject: `${event.name} deadline reminder`,
          reason: 'The founder already has a submission on file for this event.',
        });
        continue;
      }

      const profile = profilesById.get(participant.user_id);
      const preferences = preferencesByUserId.get(participant.user_id);
      const emailEnabled = preferences?.email_enabled ?? true;

      if (!profile?.email) {
        skippedResults.push({
          kind: 'event_deadline_reminder',
          userId: participant.user_id,
          email: '',
          subject: `${event.name} deadline reminder`,
          reason: 'No founder email address was found.',
        });
        continue;
      }

      if (!emailEnabled) {
        skippedResults.push({
          kind: 'event_deadline_reminder',
          userId: participant.user_id,
          email: profile.email,
          subject: `${event.name} deadline reminder`,
          reason: 'Automated email nudges are disabled.',
        });
        continue;
      }

      const dedupeKey = `event:${event.id}:${participant.user_id}`;
      const email = buildEventDeadlineNudgeEmail({
        founderName: profile.full_name,
        eventName: event.name,
        focusPrompt: prompt,
        pitchLengthSeconds: event.pitch_length_seconds,
        submissionDeadline: event.submission_deadline,
        eventDate: event.event_date,
      });

      if (dryRun) {
        eventResults.push({
          kind: 'event_deadline_reminder',
          userId: participant.user_id,
          email: profile.email,
          subject: email.subject,
        });
        continue;
      }

      try {
        const reservation = await reserveAuditRow(supabase, {
          user_id: participant.user_id,
          event_id: event.id,
          kind: 'event_deadline_reminder',
          channel: 'email',
          subject: email.subject,
          body: email.text,
          status: 'queued',
          dedupe_key: dedupeKey,
        });

        if (!reservation.inserted) {
          skippedResults.push({
            kind: 'event_deadline_reminder',
            userId: participant.user_id,
            email: profile.email,
            subject: email.subject,
            reason: 'This event reminder was already logged.',
          });
          continue;
        }

        const sendResult = await sendEmail({
          to: profile.email,
          subject: email.subject,
          text: email.text,
          html: email.html,
        });

        if (!sendResult.ok) {
          await finalizeAuditRow(supabase, reservation.id, {
            status: 'failed',
            error: sendResult.error,
          });
          failedResults.push({
            kind: 'event_deadline_reminder',
            userId: participant.user_id,
            email: profile.email,
            subject: email.subject,
            reason: sendResult.error,
          });
          continue;
        }

        await finalizeAuditRow(supabase, reservation.id, {
          status: 'sent',
          sent_at: new Date().toISOString(),
          error: null,
        });

        eventResults.push({
          kind: 'event_deadline_reminder',
          userId: participant.user_id,
          email: profile.email,
          subject: email.subject,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error while sending the event reminder.';
        failedResults.push({
          kind: 'event_deadline_reminder',
          userId: participant.user_id,
          email: profile.email,
          subject: email.subject,
          reason: message,
        });
      }
    }
  }

  return NextResponse.json({
    success: true,
    dryRun,
    summary: {
      activeGoals: activeGoals.size,
      activeEventsDue: eventRows.length,
      eventReminderUsers: eventReminderTargetUsers.size,
      dailySent: dailyResults.length,
      eventSent: eventResults.length,
      skipped: skippedResults.length,
      failed: failedResults.length,
    },
    sent: [...dailyResults, ...eventResults],
    skipped: skippedResults,
    failed: failedResults,
  });
}

export async function GET(request: NextRequest) {
  return runNudgeSweep(request);
}

export async function POST(request: NextRequest) {
  return runNudgeSweep(request);
}
