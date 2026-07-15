import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { rateLimit, getClientIp, RATE_LIMITS, formatRateLimitHeaders } from '@/lib/ratelimit';
import { createServiceSupabase } from '@/lib/admin';

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
      .maybeSingle();

    if (fetchError || !userReaction) {
      const counts = await getPitchCounts();
      return NextResponse.json(
        {
          success: true,
          counts,
        },
        { headers: formatRateLimitHeaders(result) }
      );
    }

    // Delete the reaction
    const { error: deleteError } = await mutationSupabase
      .from('reactions')
      .delete()
      .eq('id', userReaction.id)
      .eq('pitch_id', params.pitchId)
      .eq('user_id', user.id);

    if (deleteError) {
      throw deleteError;
    }

    // Reaction counters are maintained by database triggers. Manual updates from
    // the reacting user are intentionally avoided because pitch ownership RLS
    // would reject reactions on other founders' pitches.
    const counts = await getPitchCounts();

    return NextResponse.json(
      {
        success: true,
        counts,
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
