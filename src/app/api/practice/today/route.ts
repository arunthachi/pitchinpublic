import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { daysUntil, getPromptForDate, getPracticePrompt, nudgeCopy, readinessLabel } from '@/lib/practice';
import { buildRecentMomentumDays, toUtcDateKey } from '@/lib/momentum';

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

function fallbackPractice() {
  const prompt = getPromptForDate();
  return {
    success: true,
    degraded: true,
    prompt,
    nudge: nudgeCopy(prompt),
    goal: null,
    progress: {
      practiceDays: 0,
      pitchReps: 0,
      currentStreak: 0,
      bestStreak: 0,
      clarityDelta: 0,
      bestTakeId: null,
      deadlineDaysLeft: null,
      recentDays: [],
    },
    latestRep: null,
    bestTake: null,
    readiness: {
      value: null,
      label: readinessLabel(null),
    },
  };
}

export async function GET(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json(fallbackPractice());
  }

  const supabase = createSupabase(request);

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(fallbackPractice());
    }

    let goal: any = null;
    const { data: goals, error: goalError } = await supabase
      .from('practice_goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    if (goalError) {
      console.error('Error fetching practice goal:', goalError);
      return NextResponse.json(fallbackPractice());
    }

    goal = goals?.[0] || null;

    if (!goal) {
      const defaultPrompt = getPromptForDate();
      const { data: createdGoal, error: createError } = await supabase
        .from('practice_goals')
        .insert({
          user_id: user.id,
          name: 'Daily pitch practice',
          focus: defaultPrompt.focus,
          current_prompt_key: defaultPrompt.key,
          prompt_started_on: new Date().toISOString().slice(0, 10),
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating practice goal:', createError);
      } else {
        goal = createdGoal;
      }
    }

    const prompt = getPracticePrompt(goal?.current_prompt_key);

    const [{ data: reps }, { data: streak }] = await Promise.all([
      supabase
        .from('practice_reps')
        .select(`
          id,
          pitch_id,
          prompt_key,
          prompt_text,
          rep_number,
          is_best_take,
          readiness,
          clarity_delta,
          created_at,
          pitches:pitch_id (
            id,
            hook,
            thumbnail_url,
            duration,
            created_at,
            is_best_take
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('user_streaks')
        .select('current_streak,best_streak,total_activities,last_activity_date')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    const repRows = reps || [];
    const practiceDates = new Set(repRows.map((rep: any) => toUtcDateKey(rep.created_at)).filter(Boolean));
    const bestRep = repRows.find((rep: any) => rep.is_best_take || rep.pitches?.is_best_take) || null;
    const latestRep = repRows[0] || null;
    const latestReadiness = latestRep?.readiness || null;
    const recentDays = buildRecentMomentumDays(practiceDates, 7);

    return NextResponse.json({
      success: true,
      prompt,
      nudge: nudgeCopy(prompt),
      goal,
      progress: {
        practiceDays: practiceDates.size,
        pitchReps: repRows.length,
        currentStreak: streak?.current_streak || 0,
        bestStreak: streak?.best_streak || 0,
        clarityDelta: repRows.reduce((total: number, rep: any) => total + (rep.clarity_delta || 0), 0),
        bestTakeId: goal?.best_pitch_id || bestRep?.pitch_id || null,
        deadlineDaysLeft: daysUntil(goal?.target_date),
        recentDays,
      },
      latestRep,
      bestTake: bestRep,
      readiness: {
        value: latestReadiness,
        label: readinessLabel(latestReadiness),
      },
    });
  } catch (error) {
    console.error('Error loading practice today:', error);
    return NextResponse.json(fallbackPractice());
  }
}
