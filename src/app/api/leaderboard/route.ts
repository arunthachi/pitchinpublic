import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

/**
 * GET /api/leaderboard
 * Get ranked users leaderboard
 *
 * Query parameters:
 * - type: "streaks" | "pitches" | "feedback" | "badges" (default: "streaks")
 * - limit: number (default: 20, max: 100)
 * - offset: number (default: 0)
 *
 * Response:
 * {
 *   "success": true,
 *   "leaderboard": [
 *     {
 *       "rank": 1,
 *       "userId": "uuid",
 *       "userName": "string",
 *       "avatar": "url",
 *       "currentStreak": number,
 *       "bestStreak": number,
 *       "pitchesCount": number,
 *       "badgeCount": number,
 *       "totalActivities": number,
 *       "isCurrentUser": boolean
 *     }
 *   ],
 *   "total": number,
 *   "limit": number,
 *   "offset": number
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
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'streaks';
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    // Get current user (optional)
    let currentUserId = null;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) currentUserId = user.id;
    } catch (error) {
      // User not authenticated, that's fine
    }

    // Build query based on leaderboard type
    let query = supabase
      .from('profiles')
      .select(
        `
        id,
        full_name,
        avatar_url,
        pitches_count,
        user_streaks:user_streaks!inner(
          current_streak,
          best_streak,
          total_activities
        ),
        achievements(id)
      `,
        { count: 'exact' }
      );

    // Order by selected metric
    switch (type) {
      case 'pitches':
        query = query.order('pitches_count', { ascending: false });
        break;
      case 'feedback':
        query = query.order('user_streaks.total_activities', { ascending: false });
        break;
      case 'badges':
        // Will sort by badge count after fetch (requires aggregate)
        query = query.order('id', { ascending: true });
        break;
      case 'streaks':
      default:
        query = query.order('user_streaks.current_streak', { ascending: false });
        break;
    }

    // Add pagination
    query = query.range(offset, offset + limit - 1);

    const { data: profiles, count, error } = await query;

    if (error) throw error;

    // Transform data and handle badge counting
    const leaderboard = (profiles || []).map((profile: any, index: number) => {
      const streak = profile.user_streaks?.[0] || {
        current_streak: 0,
        best_streak: 0,
        total_activities: 0,
      };

      return {
        rank: offset + index + 1,
        userId: profile.id,
        userName: profile.full_name || 'Anonymous',
        avatar: profile.avatar_url || null,
        currentStreak: streak.current_streak || 0,
        bestStreak: streak.best_streak || 0,
        pitchesCount: profile.pitches_count || 0,
        badgeCount: profile.achievements?.length || 0,
        totalActivities: streak.total_activities || 0,
        isCurrentUser: currentUserId === profile.id,
      };
    });

    // Sort by badges if requested
    if (type === 'badges') {
      leaderboard.sort((a: any, b: any) => b.badgeCount - a.badgeCount);
      leaderboard.forEach((item: any, index: number) => {
        item.rank = offset + index + 1;
      });
    }

    return NextResponse.json({
      success: true,
      leaderboard,
      total: count || 0,
      limit,
      offset,
      type,
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch leaderboard',
      },
      { status: 500 }
    );
  }
}
