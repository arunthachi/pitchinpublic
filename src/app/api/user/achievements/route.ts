import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { rateLimit, getClientIp, RATE_LIMITS, formatRateLimitHeaders } from '@/lib/ratelimit';

/**
 * GET /api/user/achievements
 * Get user's unlocked achievements
 *
 * Response:
 * {
 *   "success": true,
 *   "achievements": [
 *     {
 *       "id": "uuid",
 *       "badgeId": "first_pitch",
 *       "badgeName": "First Pitch",
 *       "badgeDescription": "Published your first pitch",
 *       "badgeIcon": "🎬",
 *       "unlockedAt": "timestamp"
 *     }
 *   ]
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

    // Get achievements
    const { data: achievements, error: achievError } = await supabase
      .from('achievements')
      .select('id, badge_id, unlocked_at')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false });

    if (achievError) throw achievError;

    // Define badge metadata
    const badgeMetadata: Record<
      string,
      { name: string; description: string; icon: string }
    > = {
      first_pitch: {
        name: 'First Pitch',
        description: 'Published your first pitch',
        icon: '🎬',
      },
      five_pitches: {
        name: 'Five-Time Pitcher',
        description: 'Published 5 pitches',
        icon: '5️⃣',
      },
      ten_pitches: {
        name: 'Prolific Pitcher',
        description: 'Published 10 pitches',
        icon: '🔟',
      },
      five_day_streak: {
        name: 'On Fire',
        description: 'Maintained a 5-day streak',
        icon: '🔥',
      },
      ten_day_streak: {
        name: 'On a Roll',
        description: 'Maintained a 10-day streak',
        icon: '⚡',
      },
      fifty_roasts: {
        name: 'Constructive Critic',
        description: 'Given 50 roasts',
        icon: '🔥',
      },
      fifty_toasts: {
        name: 'Cheerleader',
        description: 'Given 50 toasts',
        icon: '🥂',
      },
      feedback_expert: {
        name: 'Feedback Expert',
        description: 'Submitted 25 detailed feedback responses',
        icon: '💡',
      },
    };

    const formattedAchievements = (achievements || []).map((a) => {
      const metadata = badgeMetadata[a.badge_id] || {
        name: 'Unknown Badge',
        description: '',
        icon: '🏆',
      };
      return {
        id: a.id,
        badgeId: a.badge_id,
        badgeName: metadata.name,
        badgeDescription: metadata.description,
        badgeIcon: metadata.icon,
        unlockedAt: a.unlocked_at,
      };
    });

    return NextResponse.json({
      success: true,
      achievements: formattedAchievements,
    });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch achievements',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/achievements/unlock
 * Unlock a new achievement (called when conditions are met)
 *
 * Request body:
 * {
 *   "badgeId": "first_pitch" | "five_pitches" | etc
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "achievement": {
 *     "id": "uuid",
 *     "badgeId": "string",
 *     "badgeName": "string",
 *     "badgeIcon": "string",
 *     "isNew": boolean
 *   }
 * }
 */
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

    const body = await request.json();
    const { badgeId } = body;

    if (!badgeId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Badge ID is required',
        },
        {
          status: 400,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    // Check if achievement already unlocked
    const { data: existing } = await supabase
      .from('achievements')
      .select('id')
      .eq('user_id', user.id)
      .eq('badge_id', badgeId)
      .single();

    if (existing) {
      // Already unlocked
      return NextResponse.json(
        {
          success: true,
          achievement: {
            id: existing.id,
            badgeId,
            isNew: false,
          },
        },
        { headers: formatRateLimitHeaders(result) }
      );
    }

    // Unlock new achievement
    const { data: achievement, error: insertError } = await supabase
      .from('achievements')
      .insert({
        user_id: user.id,
        badge_id: badgeId,
        unlocked_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      // Handle unique constraint error (already unlocked)
      if (insertError.code === '23505') {
        return NextResponse.json(
          {
            success: true,
            achievement: { id: '', badgeId, isNew: false },
          },
          { headers: formatRateLimitHeaders(result) }
        );
      }
      throw insertError;
    }

    // Define badge metadata
    const badgeMetadata: Record<
      string,
      { name: string; icon: string }
    > = {
      first_pitch: { name: 'First Pitch', icon: '🎬' },
      five_pitches: { name: 'Five-Time Pitcher', icon: '5️⃣' },
      ten_pitches: { name: 'Prolific Pitcher', icon: '🔟' },
      five_day_streak: { name: 'On Fire', icon: '🔥' },
      ten_day_streak: { name: 'On a Roll', icon: '⚡' },
      fifty_roasts: { name: 'Constructive Critic', icon: '🔥' },
      fifty_toasts: { name: 'Cheerleader', icon: '🥂' },
      feedback_expert: { name: 'Feedback Expert', icon: '💡' },
    };

    const metadata = badgeMetadata[badgeId] || {
      name: 'Unknown Badge',
      icon: '🏆',
    };

    return NextResponse.json(
      {
        success: true,
        achievement: {
          id: achievement.id,
          badgeId: achievement.badge_id,
          badgeName: metadata.name,
          badgeIcon: metadata.icon,
          isNew: true,
        },
      },
      { headers: formatRateLimitHeaders(result) }
    );
  } catch (error) {
    console.error('Error unlocking achievement:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unlock achievement',
      },
      {
        status: 500,
        headers: formatRateLimitHeaders(result),
      }
    );
  }
}
