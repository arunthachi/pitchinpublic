import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { rateLimit, getClientIp, RATE_LIMITS, formatRateLimitHeaders } from '@/lib/ratelimit';
import { INVITE_ONLY_MESSAGE, isUserAllowedForPilot } from '@/lib/pilot-access';

/**
 * POST /api/pitches/[pitchId]/bookmark
 * Add a bookmark to a pitch
 *
 * Rate Limited: 100 requests per hour per IP
 *
 * Request body: (optional)
 * {}
 *
 * Response:
 * {
 *   "success": true,
 *   "isBookmarked": true,
 *   "bookmarkCount": 5
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

    if (!(await isUserAllowedForPilot(user))) {
      return NextResponse.json(
        {
          success: false,
          error: INVITE_ONLY_MESSAGE,
          code: 'invite_required',
        },
        {
          status: 403,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    const pitchId = params.pitchId;

    // Try to create a bookmark
    const { data: bookmark, error: bookmarkError } = await supabase
      .from('bookmarks')
      .insert({
        pitch_id: pitchId,
        user_id: user.id,
      })
      .select()
      .single();

    if (bookmarkError) {
      // If it's a unique constraint error, bookmark already exists
      if (bookmarkError.code === '23505') {
        const { count } = await supabase
          .from('bookmarks')
          .select('*', { count: 'exact', head: true })
          .eq('pitch_id', pitchId);

        return NextResponse.json(
          {
            success: true,
            isBookmarked: true,
            bookmarkCount: count || 0,
          },
          {
            headers: formatRateLimitHeaders(result),
          }
        );
      }

      throw bookmarkError;
    }

    // Get updated bookmark count
    const { count } = await supabase
      .from('bookmarks')
      .select('*', { count: 'exact', head: true })
      .eq('pitch_id', pitchId);

    return NextResponse.json(
      {
        success: true,
        isBookmarked: true,
        bookmarkCount: count || 0,
      },
      {
        headers: formatRateLimitHeaders(result),
      }
    );
  } catch (error) {
    console.error('Error adding bookmark:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add bookmark',
      },
      {
        status: 500,
        headers: formatRateLimitHeaders(result),
      }
    );
  }
}

/**
 * DELETE /api/pitches/[pitchId]/bookmark
 * Remove a bookmark from a pitch
 *
 * Response:
 * {
 *   "success": true,
 *   "isBookmarked": false,
 *   "bookmarkCount": 4
 * }
 */
export async function DELETE(request: NextRequest, props: { params: Promise<{ pitchId: string }> }) {
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

    if (!(await isUserAllowedForPilot(user))) {
      return NextResponse.json(
        {
          success: false,
          error: INVITE_ONLY_MESSAGE,
          code: 'invite_required',
        },
        {
          status: 403,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    const pitchId = params.pitchId;

    // Delete the bookmark
    const { error: deleteError } = await supabase
      .from('bookmarks')
      .delete()
      .eq('pitch_id', pitchId)
      .eq('user_id', user.id);

    if (deleteError) {
      throw deleteError;
    }

    // Get updated bookmark count
    const { count } = await supabase
      .from('bookmarks')
      .select('*', { count: 'exact', head: true })
      .eq('pitch_id', pitchId);

    return NextResponse.json(
      {
        success: true,
        isBookmarked: false,
        bookmarkCount: count || 0,
      },
      {
        headers: formatRateLimitHeaders(result),
      }
    );
  } catch (error) {
    console.error('Error removing bookmark:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove bookmark',
      },
      {
        status: 500,
        headers: formatRateLimitHeaders(result),
      }
    );
  }
}

/**
 * GET /api/pitches/[pitchId]/bookmark
 * Check if current user has bookmarked this pitch
 *
 * Response:
 * {
 *   "success": true,
 *   "isBookmarked": true,
 *   "bookmarkCount": 5
 * }
 */
export async function GET(request: NextRequest, props: { params: Promise<{ pitchId: string }> }) {
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
    // Get authenticated user (optional for this endpoint)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const pitchId = params.pitchId;

    // Get total bookmark count
    const { count: bookmarkCount } = await supabase
      .from('bookmarks')
      .select('*', { count: 'exact', head: true })
      .eq('pitch_id', pitchId);

    // Check if current user has bookmarked
    let isBookmarked = false;
    if (user) {
      const { data: userBookmark } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('pitch_id', pitchId)
        .eq('user_id', user.id)
        .single();

      isBookmarked = !!userBookmark;
    }

    return NextResponse.json({
      success: true,
      isBookmarked,
      bookmarkCount: bookmarkCount || 0,
    });
  } catch (error) {
    console.error('Error checking bookmark:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check bookmark',
      },
      { status: 500 }
    );
  }
}
