import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { rateLimit, getClientIp, RATE_LIMITS, formatRateLimitHeaders } from '@/lib/ratelimit';

/**
 * DELETE /api/pitches/[pitchId]/delete
 * Soft delete a pitch (mark as deleted)
 *
 * Rate Limited: 30 requests per hour per IP
 *
 * Path parameters:
 * - pitchId: UUID of the pitch to delete
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Pitch deleted successfully"
 * }
 */
export async function DELETE(request: NextRequest, props: { params: Promise<{ pitchId: string }> }) {
  const params = await props.params;
  const ip = getClientIp(request);

  // Apply rate limiting
  const result = await rateLimit({
    key: `${ip}:delete-pitch`,
    limit: 30,
    window: 3600, // 1 hour
  });

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many delete requests. Please try again later.',
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

    // Verify pitch exists and belongs to the user
    const { data: pitch, error: fetchError } = await supabase
      .from('pitches')
      .select('id, user_id, deleted_at')
      .eq('id', params.pitchId)
      .single();

    if (fetchError || !pitch) {
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

    // Verify the user owns this pitch
    if (pitch.user_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'You can only delete your own pitches',
        },
        {
          status: 403,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    // Check if already deleted
    if (pitch.deleted_at) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pitch is already deleted',
        },
        {
          status: 400,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    // Soft delete the pitch by setting deleted_at timestamp
    const { error: deleteError } = await supabase
      .from('pitches')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.pitchId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting pitch:', deleteError);
      throw deleteError;
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Pitch deleted successfully',
      },
      {
        status: 200,
        headers: formatRateLimitHeaders(result),
      }
    );
  } catch (error) {
    console.error('Error in delete pitch endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete pitch',
      },
      {
        status: 500,
        headers: formatRateLimitHeaders(result),
      }
    );
  }
}
