import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { rateLimit, getClientIp, RATE_LIMITS, formatRateLimitHeaders } from '@/lib/ratelimit';
import { createServiceSupabase } from '@/lib/admin';

/**
 * POST /api/pitches/[pitchId]/reaction
 * Create a roast or toast reaction on a pitch
 *
 * Rate Limited: 100 requests per hour per IP
 *
 * Request body:
 * {
 *   "type": "roast" | "toast"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "reaction": {
 *     "id": "uuid",
 *     "type": "roast" | "toast",
 *     "createdAt": "timestamp"
 *   },
 *   "counts": {
 *     "roastCount": number,
 *     "toastCount": number
 *   }
 * }
 */
export async function POST(request: NextRequest, props: { params: Promise<{ pitchId: string }> }) {
  const params = await props.params;
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
  const mutationSupabase = createServiceSupabase() || supabase;

  async function getPitchCounts() {
    const { data } = await mutationSupabase
      .from('pitches')
      .select('roast_count, toast_count')
      .eq('id', params.pitchId)
      .single();

    return {
      roastCount: data?.roast_count || 0,
      toastCount: data?.toast_count || 0,
    };
  }

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

    // Validate pitch exists
    const { data: pitch, error: pitchError } = await supabase
      .from('pitches')
      .select('id')
      .eq('id', params.pitchId)
      .single();

    if (pitchError || !pitch) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pitch not found',
        },
        {
          status: 404,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { type } = body;

    if (!['roast', 'toast'].includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid reaction type. Must be "roast" or "toast".',
        },
        {
          status: 400,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    // Check if user already reacted. The table enforces one reaction per user per pitch,
    // so switching from Toast to Roast must replace the existing row.
    const { data: existingReaction, error: checkError } = await supabase
      .from('reactions')
      .select('id,type')
      .eq('pitch_id', params.pitchId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    if (existingReaction && existingReaction.type === type) {
      const counts = await getPitchCounts();
      return NextResponse.json(
        {
          success: true,
          reaction: {
            id: existingReaction.id,
            type: existingReaction.type,
            createdAt: null,
          },
          counts,
        },
        { headers: formatRateLimitHeaders(result) }
      );
    }

    if (existingReaction) {
      const { error: deleteExistingError } = await mutationSupabase
        .from('reactions')
        .delete()
        .eq('id', existingReaction.id)
        .eq('pitch_id', params.pitchId)
        .eq('user_id', user.id);

      if (deleteExistingError) {
        throw deleteExistingError;
      }
    }

    // Insert reaction
    const { data: reaction, error: insertError } = await mutationSupabase
      .from('reactions')
      .insert({
        pitch_id: params.pitchId,
        user_id: user.id,
        type,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Reaction counters are maintained by database triggers. Manual updates from
    // the reacting user are intentionally avoided because pitch ownership RLS
    // would reject reactions on other founders' pitches.
    const updatedCounts = await getPitchCounts();

    // Update streak (any activity counts toward streak)
    try {
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

      // Always increment total_activities
      const newTotalActivities = (streakData.total_activities || 0) + 1;

      // Check if user already has activity today
      const hasActivityToday = streakData.last_activity_date === today;
      let newCurrentStreak = streakData.current_streak || 0;

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
        }
      }

      const newBestStreak = Math.max(streakData.best_streak || 0, newCurrentStreak);

      // Update streak in database
      await supabase.from('user_streaks').upsert({
        user_id: user.id,
        current_streak: newCurrentStreak,
        best_streak: newBestStreak,
        last_activity_date: hasActivityToday ? streakData.last_activity_date : today,
        last_activity_type: type,
        total_activities: newTotalActivities,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);

      console.log('Streak updated for reaction:', { newTotalActivities, newCurrentStreak });
    } catch (error) {
      console.error('Error updating streak:', error);
      // Non-fatal, don't throw
    }

    return NextResponse.json(
      {
        success: true,
        reaction: {
          id: reaction.id,
          type: reaction.type,
          createdAt: reaction.created_at,
        },
        counts: updatedCounts,
      },
      { headers: formatRateLimitHeaders(result) }
    );
  } catch (error) {
    console.error('Error creating reaction:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create reaction',
      },
      {
        status: 500,
        headers: formatRateLimitHeaders(result),
      }
    );
  }
}
