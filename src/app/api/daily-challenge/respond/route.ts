import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { rateLimit, getClientIp, RATE_LIMITS, formatRateLimitHeaders } from '@/lib/ratelimit';
import { z } from 'zod';

/**
 * POST /api/daily-challenge/respond
 * Record user's response to daily challenge
 *
 * Request body:
 * {
 *   "challengeId": "uuid",
 *   "response": "string (max 2000 chars)",
 *   "pitchId": "uuid (optional - if they posted a pitch for the challenge)"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "response": {
 *     "id": "uuid",
 *     "challengeId": "uuid",
 *     "createdAt": "timestamp"
 *   },
 *   "streak": {...}
 * }
 */

const responseSchema = z.object({
  challengeId: z.string().uuid(),
  response: z.string().max(2000, 'Response must be at most 2000 characters'),
  pitchId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  const result = await rateLimit({
    key: ip,
    limit: RATE_LIMITS.API.limit,
    window: RATE_LIMITS.API.window,
  });

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many requests.',
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

    // Validate request
    const body = await request.json();
    const validation = responseSchema.safeParse(body);

    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        errors[path] = issue.message;
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid response data',
          errors,
        },
        {
          status: 400,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    const { challengeId, response: responseText, pitchId } = validation.data;

    // Verify challenge exists
    const { data: challenge, error: challengeError } = await supabase
      .from('daily_challenges')
      .select('id')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challenge) {
      return NextResponse.json(
        {
          success: false,
          error: 'Challenge not found',
        },
        {
          status: 404,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    // Check if user already responded today
    const { data: existingResponse } = await supabase
      .from('challenge_responses')
      .select('id')
      .eq('challenge_id', challengeId)
      .eq('user_id', user.id)
      .single();

    if (existingResponse) {
      return NextResponse.json(
        {
          success: false,
          error: 'You have already responded to today's challenge',
        },
        {
          status: 400,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    // Insert response
    const { data: response, error: insertError } = await supabase
      .from('challenge_responses')
      .insert({
        challenge_id: challengeId,
        user_id: user.id,
        response: responseText,
        pitch_id: pitchId || null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Update user streak (challenge response counts as activity)
    let streakData = null;
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get current streak
      const { data: currentStreak } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const streak = currentStreak || {
        current_streak: 0,
        best_streak: 0,
        last_activity_date: null,
        total_activities: 0,
      };

      // Only update if not already updated today
      if (streak.last_activity_date !== today) {
        const yesterday = new Date(new Date().setDate(new Date().getDate() - 1))
          .toISOString()
          .split('T')[0];

        let newCurrentStreak = 1;
        if (streak.last_activity_date === yesterday) {
          newCurrentStreak = (streak.current_streak || 0) + 1;
        }

        const newBestStreak = Math.max(streak.best_streak || 0, newCurrentStreak);

        await supabase
          .from('user_streaks')
          .upsert({
            user_id: user.id,
            current_streak: newCurrentStreak,
            best_streak: newBestStreak,
            last_activity_date: today,
            last_activity_type: 'challenge',
            total_activities: (streak.total_activities || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        streakData = {
          currentStreak: newCurrentStreak,
          bestStreak: newBestStreak,
        };
      } else {
        streakData = {
          currentStreak: streak.current_streak || 0,
          bestStreak: streak.best_streak || 0,
        };
      }
    } catch (error) {
      console.error('Error updating streak:', error);
      // Non-fatal
    }

    return NextResponse.json(
      {
        success: true,
        response: {
          id: response.id,
          challengeId: response.challenge_id,
          createdAt: response.created_at,
        },
        streak: streakData,
      },
      { headers: formatRateLimitHeaders(result) }
    );
  } catch (error) {
    console.error('Error submitting challenge response:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit response',
      },
      {
        status: 500,
        headers: formatRateLimitHeaders(result),
      }
    );
  }
}
