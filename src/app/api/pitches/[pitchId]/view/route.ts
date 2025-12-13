import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { rateLimit, getClientIp, RATE_LIMITS, formatRateLimitHeaders } from '@/lib/ratelimit';

/**
 * POST /api/pitches/[pitchId]/view
 * Increment view count for a pitch
 *
 * Rate Limited: 100 requests per hour per IP
 *
 * Response:
 * {
 *   "success": true,
 *   "viewsCount": number
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { pitchId: string } }
) {
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
    // Get current pitch
    const { data: pitch, error: fetchError } = await supabase
      .from('pitches')
      .select('views_count')
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

    // Increment views count by 1
    const newViewsCount = (pitch.views_count || 0) + 1;

    const { data: updatedPitch, error: updateError } = await supabase
      .from('pitches')
      .update({ views_count: newViewsCount })
      .eq('id', params.pitchId)
      .select('views_count')
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json(
      {
        success: true,
        viewsCount: updatedPitch?.views_count || newViewsCount,
      },
      { headers: formatRateLimitHeaders(result) }
    );
  } catch (error) {
    console.error('Error incrementing pitch view:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to increment view',
      },
      {
        status: 500,
        headers: formatRateLimitHeaders(result),
      }
    );
  }
}

