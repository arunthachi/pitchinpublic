import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { rateLimit, getClientIp, RATE_LIMITS, formatRateLimitHeaders } from '@/lib/ratelimit';

/**
 * POST /api/users/[userId]/follow
 * Follow a user
 *
 * Response:
 * {
 *   "success": true,
 *   "isFollowing": boolean
 * }
 */
export async function POST(request: NextRequest, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const ip = getClientIp(request);

  // Apply rate limiting
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

    // Can't follow yourself
    if (user.id === params.userId) {
      return NextResponse.json(
        {
          success: false,
          error: "You can't follow yourself",
        },
        {
          status: 400,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    // Check if already following
    const { data: existingFollow, error: followError } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', params.userId)
      .single();

    if (existingFollow) {
      // Already following, return success
      return NextResponse.json(
        {
          success: true,
          isFollowing: true,
        },
        { headers: formatRateLimitHeaders(result) }
      );
    }

    // If there's an error other than "no rows found", throw it
    if (followError && followError.code !== 'PGRST116') {
      throw followError;
    }

    // Create follow relationship
    const { error: insertError } = await supabase.from('follows').insert({
      follower_id: user.id,
      following_id: params.userId,
    });

    if (insertError) {
      // Handle unique constraint error (already following)
      if (insertError.code === '23505') {
        return NextResponse.json(
          {
            success: true,
            isFollowing: true,
          },
          { headers: formatRateLimitHeaders(result) }
        );
      }
      throw insertError;
    }

    return NextResponse.json(
      {
        success: true,
        isFollowing: true,
      },
      { headers: formatRateLimitHeaders(result) }
    );
  } catch (error) {
    console.error('Error following user:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to follow user',
      },
      {
        status: 500,
        headers: formatRateLimitHeaders(result),
      }
    );
  }
}

/**
 * DELETE /api/users/[userId]/follow
 * Unfollow a user
 *
 * Response:
 * {
 *   "success": true,
 *   "isFollowing": boolean
 * }
 */
export async function DELETE(request: NextRequest, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const ip = getClientIp(request);

  // Apply rate limiting
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

    // Delete follow relationship
    const { error: deleteError } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', params.userId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json(
      {
        success: true,
        isFollowing: false,
      },
      { headers: formatRateLimitHeaders(result) }
    );
  } catch (error) {
    console.error('Error unfollowing user:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unfollow user',
      },
      {
        status: 500,
        headers: formatRateLimitHeaders(result),
      }
    );
  }
}

/**
 * GET /api/users/[userId]/follow
 * Check if current user follows this user
 *
 * Response:
 * {
 *   "isFollowing": boolean
 * }
 */
export async function GET(request: NextRequest, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
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
      // Not authenticated, so not following
      return NextResponse.json({
        isFollowing: false,
      });
    }

    // Check if following
    const { data: follow, error: followError } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', params.userId)
      .single();

    // If error is "no rows found" (PGRST116), that's expected and means not following
    // Any other error should be thrown
    if (followError && followError.code !== 'PGRST116') {
      throw followError;
    }

    return NextResponse.json({
      isFollowing: !!follow,
    });
  } catch (error) {
    console.error('Error checking follow status:', error);
    return NextResponse.json({
      isFollowing: false,
    });
  }
}
