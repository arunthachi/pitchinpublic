import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { rateLimit, getClientIp, RATE_LIMITS, formatRateLimitHeaders } from '@/lib/ratelimit';

/**
 * DELETE /api/pitches/[pitchId]/reaction/delete
 * Remove user's reaction from a pitch (toggle off)
 *
 * Response:
 * {
 *   "success": true,
 *   "counts": {
 *     "roastCount": number,
 *     "toastCount": number
 *   }
 * }
 */
export async function DELETE(request: NextRequest, props: { params: Promise<{ pitchId: string }> }) {
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
    // Get current user
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

    // Get user's current reaction
    const { data: userReaction, error: fetchError } = await supabase
      .from('reactions')
      .select('id, type')
      .eq('pitch_id', params.pitchId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !userReaction) {
      // No reaction to delete
      const { data: pitch } = await supabase
        .from('pitches')
        .select('roast_count, toast_count')
        .eq('id', params.pitchId)
        .single();

      return NextResponse.json(
        {
          success: true,
          counts: {
            roastCount: pitch?.roast_count || 0,
            toastCount: pitch?.toast_count || 0,
          },
        },
        { headers: formatRateLimitHeaders(result) }
      );
    }

    const reactionType = userReaction.type;

    // Delete the reaction
    const { error: deleteError } = await supabase
      .from('reactions')
      .delete()
      .eq('id', userReaction.id);

    if (deleteError) {
      throw deleteError;
    }

    // Decrement pitch counter
    const { data: pitch, error: fetchPitchError } = await supabase
      .from('pitches')
      .select('roast_count, toast_count')
      .eq('id', params.pitchId)
      .single();

    if (!pitch || fetchPitchError) {
      throw new Error('Could not fetch pitch');
    }

    const updateData: Record<string, number> = {};
    if (reactionType === 'roast') {
      updateData.roast_count = Math.max(0, pitch.roast_count - 1);
    } else {
      updateData.toast_count = Math.max(0, pitch.toast_count - 1);
    }

    const { data: updatedPitch, error: updateError } = await supabase
      .from('pitches')
      .update(updateData)
      .eq('id', params.pitchId)
      .select('roast_count, toast_count')
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json(
      {
        success: true,
        counts: {
          roastCount: updatedPitch?.roast_count || pitch.roast_count,
          toastCount: updatedPitch?.toast_count || pitch.toast_count,
        },
      },
      { headers: formatRateLimitHeaders(result) }
    );
  } catch (error) {
    console.error('Error deleting reaction:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete reaction',
      },
      {
        status: 500,
        headers: formatRateLimitHeaders(result),
      }
    );
  }
}
