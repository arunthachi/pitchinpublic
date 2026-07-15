import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { rateLimit, getClientIp, RATE_LIMITS, formatRateLimitHeaders } from '@/lib/ratelimit';
import {
  buildRecentMomentumDays,
  getConsecutiveRun,
  getLongestRun,
  toUtcDateKey,
} from '@/lib/momentum';

/**
 * GET /api/user/streak
 * Get current user's streak information
 *
 * Response:
 * {
 *   "success": true,
 *   "streak": {
 *     "currentStreak": number,
 *     "bestStreak": number,
 *     "lastActivityDate": "YYYY-MM-DD",
 *     "totalActivities": number,
 *     "isActiveToday": boolean
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  const supabase = createServerClient(
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

  try {
    // Check if user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    // Get streak data
    const { data: streak, error: streakError } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (streakError && streakError.code !== 'PGRST116') {
      throw streakError;
    }

    const { data: recentPitches, error: pitchesError } = await supabase
      .from('pitches')
      .select('id,created_at')
      .eq('user_id', user.id)
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (pitchesError) {
      console.error('Error fetching pitch momentum:', pitchesError);
    }

    const pitchRows = recentPitches || [];
    const activeDates = new Set(
      pitchRows
        .map((pitch) => (pitch.created_at ? toUtcDateKey(pitch.created_at) : ''))
        .filter(Boolean)
    );
    const today = toUtcDateKey(new Date());
    const isActiveToday = activeDates.has(today) || streak?.last_activity_date === today;
    const currentRunStart = isActiveToday ? 0 : 1;
    const pitchCurrentStreak = getConsecutiveRun(activeDates, currentRunStart);
    const pitchBestStreak = getLongestRun(activeDates);
    const recentDays = buildRecentMomentumDays(activeDates, 7);

    // If no streak record exists, create one, but still return pitch-derived momentum.
    if (!streak) {
      const { error: createError } = await supabase
        .from('user_streaks')
        .insert({
          user_id: user.id,
          current_streak: pitchCurrentStreak,
          best_streak: pitchBestStreak,
          last_activity_date: isActiveToday ? today : null,
          last_activity_type: null,
          total_activities: pitchRows.length,
        })
        .select()
        .single();

      if (createError) throw createError;

      return NextResponse.json({
        success: true,
        streak: {
          currentStreak: pitchCurrentStreak,
          bestStreak: pitchBestStreak,
          lastActivityDate: isActiveToday ? today : null,
          totalActivities: pitchRows.length,
          pitchReps: pitchRows.length,
          isActiveToday,
          recentDays,
        },
      });
    }

    const aggregateCurrentStreak = streak.current_streak || 0;
    const aggregateBestStreak = streak.best_streak || 0;
    const aggregateTotal = streak.total_activities || 0;

    return NextResponse.json({
      success: true,
      streak: {
        currentStreak: Math.max(aggregateCurrentStreak, pitchCurrentStreak),
        bestStreak: Math.max(aggregateBestStreak, pitchBestStreak),
        lastActivityDate: isActiveToday ? today : streak.last_activity_date,
        totalActivities: Math.max(aggregateTotal, pitchRows.length),
        pitchReps: pitchRows.length,
        isActiveToday,
        recentDays,
      },
    });
  } catch (error) {
    console.error('Error fetching streak:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch streak',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/streak
 * Update user's streak (called after any activity: pitch, roast, toast, feedback)
 *
 * Request body:
 * {
 *   "activityType": "pitch" | "roast" | "toast" | "feedback"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "streak": {
 *     "currentStreak": number,
 *     "bestStreak": number,
 *     "isNewStreak": boolean,
 *     "streakMilestone": boolean,
 *     "streakDays": number
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // Apply rate limiting: 100 requests per hour per IP
  const result = await rateLimit({
    key: ip,
    limit: RATE_LIMITS.API.limit,
    window: RATE_LIMITS.API.window,
  });

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many requests. Please try again later.',
      },
      {
        status: 429,
        headers: formatRateLimitHeaders(result),
      }
    );
  }

  const supabase = createServerClient(
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

  try {
    // Check if user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        {
          status: 401,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    const body = await request.json();
    const { activityType } = body;

    if (!activityType) {
      return NextResponse.json(
        {
          success: false,
          error: 'Activity type is required',
        },
        {
          status: 400,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    // Get current date
    const today = new Date().toISOString().split('T')[0];

    // Get current streak
    const { data: currentStreak } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const streakData = currentStreak || {
      current_streak: 0,
      best_streak: 0,
      last_activity_date: null,
      total_activities: 0,
    };

    // Check if user already has activity today
    const hasActivityToday = streakData.last_activity_date === today;

    let newCurrentStreak = streakData.current_streak || 0;
    let isNewStreak = false;
    let streakMilestone = false;

    // Always increment total activities (for every reaction/pitch)
    const newTotalActivities = (streakData.total_activities || 0) + 1;

    if (!hasActivityToday) {
      // Check if yesterday had activity (continue streak)
      const yesterday = new Date(new Date().setDate(new Date().getDate() - 1))
        .toISOString()
        .split('T')[0];
      const yesterdayWasActive = streakData.last_activity_date === yesterday;

      if (yesterdayWasActive) {
        // Continue streak
        newCurrentStreak = (streakData.current_streak || 0) + 1;
      } else {
        // Start new streak
        newCurrentStreak = 1;
        isNewStreak = true;
      }

      // Check for milestone (5, 10, 25, 50, 100 day streaks)
      const milestones = [5, 10, 25, 50, 100];
      if (milestones.includes(newCurrentStreak)) {
        streakMilestone = true;
      }
    }

    // Update best streak if needed
    const newBestStreak = Math.max(streakData.best_streak || 0, newCurrentStreak);

    // Update streak in database (always update to increment total_activities)
    const { error: updateError } = await supabase
      .from('user_streaks')
      .upsert({
        user_id: user.id,
        current_streak: newCurrentStreak,
        best_streak: newBestStreak,
        last_activity_date: hasActivityToday ? streakData.last_activity_date : today,
        last_activity_type: activityType,
        total_activities: newTotalActivities,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) throw updateError;

    return NextResponse.json(
      {
        success: true,
        streak: {
          currentStreak: newCurrentStreak,
          bestStreak: Math.max(streakData.best_streak || 0, newCurrentStreak),
          isNewStreak,
          streakMilestone,
          streakDays: newCurrentStreak,
        },
      },
      { headers: formatRateLimitHeaders(result) }
    );
  } catch (error) {
    console.error('Error updating streak:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update streak',
      },
      {
        status: 500,
        headers: formatRateLimitHeaders(result),
      }
    );
  }
}
