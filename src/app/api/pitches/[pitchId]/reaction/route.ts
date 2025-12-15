import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { rateLimit, getClientIp, RATE_LIMITS, formatRateLimitHeaders } from '@/lib/ratelimit';

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
export async function POST(
  request: NextRequest,
  { params }: { params: { pitchId: string } }
) {
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

    // Validate pitch exists
    const { data: pitch, error: pitchError } = await supabase
      .from('pitches')
      .select('id, roast_count, toast_count')
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

    // Check if user already reacted with same type
    const { data: existingReaction, error: checkError } = await supabase
      .from('reactions')
      .select('id')
      .eq('pitch_id', params.pitchId)
      .eq('user_id', user.id)
      .eq('type', type)
      .single();

    if (!checkError && existingReaction) {
      // User already has this reaction type, skip creation
      return NextResponse.json(
        {
          success: true,
          reaction: null,
          counts: {
            roastCount: pitch.roast_count,
            toastCount: pitch.toast_count,
          },
        },
        { headers: formatRateLimitHeaders(result) }
      );
    }

    // Insert reaction
    const { data: reaction, error: insertError } = await supabase
      .from('reactions')
      .insert({
        pitch_id: params.pitchId,
        user_id: user.id,
        type,
      })
      .select()
      .single();

    if (insertError) {
      // Handle unique constraint error (user already reacted)
      if (insertError.code === '23505') {
        return NextResponse.json(
          {
            success: true,
            reaction: null,
            counts: {
              roastCount: pitch.roast_count,
              toastCount: pitch.toast_count,
            },
          },
          { headers: formatRateLimitHeaders(result) }
        );
      }
      throw insertError;
    }

    // Update pitch counters based on reaction type
    const updateData: Record<string, number> = {};
    if (type === 'roast') {
      updateData.roast_count = pitch.roast_count + 1;
    } else {
      updateData.toast_count = pitch.toast_count + 1;
    }

    const { error: updateError } = await supabase
      .from('pitches')
      .update(updateData)
      .eq('id', params.pitchId);

    if (updateError) {
      throw updateError;
    }

    // Calculate updated counts
    const updatedCounts = {
      roastCount: type === 'roast' ? pitch.roast_count + 1 : pitch.roast_count,
      toastCount: type === 'toast' ? pitch.toast_count + 1 : pitch.toast_count,
    };

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
