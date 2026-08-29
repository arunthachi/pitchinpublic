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

    // The database function owns authorization, lock order, queue invalidation,
    // and the public-count transition in one transaction.
    const { data: deletion, error: deleteError } = await supabase.rpc('soft_delete_pitch_locked', {
      target_pitch_id: params.pitchId,
    });

    if (deleteError) {
      console.error('Error deleting pitch:', deleteError);
      throw deleteError;
    }

    const deletionResult = deletion && typeof deletion === 'object' && !Array.isArray(deletion)
      ? deletion as { deleted?: boolean; reason?: string }
      : null;
    if (!deletionResult?.deleted) {
      const alreadyDeleted = deletionResult?.reason === 'already_deleted';
      return NextResponse.json(
        { success: false, error: alreadyDeleted ? 'Pitch is already deleted' : 'Pitch not found' },
        { status: alreadyDeleted ? 400 : 404, headers: formatRateLimitHeaders(result) },
      );
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
