import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { rateLimit, getClientIp, RATE_LIMITS, formatRateLimitHeaders } from '@/lib/ratelimit';

/**
 * POST /api/pitches/[pitchId]/reaction
 * Create a roast or toast reaction on a pitch
 *
 * Rate Limited: 100 requests per hour per IP
 *
 * Request body:
 * {
 *   "type": "roast" | "toast"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "reaction": {
 *     "id": "uuid",
 *     "type": "roast" | "toast",
 *     "createdAt": "timestamp"
 *   },
 *   "counts": {
 *     "roastCount": number,
 *     "toastCount": number
 *   }
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { pitchId: string } }
) {
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

    // Validate pitch exists
    const { data: pitch, error: pitchError } = await supabase
      .from('pitches')
      .select('id, roast_count, toast_count')
      .eq('id', params.pitchId)
      .single();

    if (pitchError || !pitch) {
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

    // Parse and validate request body
    const body = await request.json();
    const { type } = body;

    if (!['roast', 'toast'].includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid reaction type. Must be "roast" or "toast".',
        },
        {
          status: 400,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    // Check if user already reacted with same type
    const { data: existingReaction, error: checkError } = await supabase
      .from('reactions')
      .select('id')
      .eq('pitch_id', params.pitchId)
      .eq('user_id', user.id)
      .eq('type', type)
      .single();

    if (!checkError && existingReaction) {
      // User already has this reaction type, skip creation
      return NextResponse.json(
        {
          success: true,
          reaction: null,
          counts: {
            roastCount: pitch.roast_count,
            toastCount: pitch.toast_count,
          },
        },
        { headers: formatRateLimitHeaders(result) }
      );
    }

    // Insert reaction
    const { data: reaction, error: insertError } = await supabase
      .from('reactions')
      .insert({
        pitch_id: params.pitchId,
        user_id: user.id,
        type,
      })
      .select()
      .single();

    if (insertError) {
      // Handle unique constraint error (user already reacted)
      if (insertError.code === '23505') {
        return NextResponse.json(
          {
            success: true,
            reaction: null,
            counts: {
              roastCount: pitch.roast_count,
              toastCount: pitch.toast_count,
            },
          },
          { headers: formatRateLimitHeaders(result) }
        );
      }
      throw insertError;
    }

    // Update pitch counters based on reaction type
    const updateData: Record<string, number> = {};
    if (type === 'roast') {
      updateData.roast_count = pitch.roast_count + 1;
    } else {
      updateData.toast_count = pitch.toast_count + 1;
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

    // Update streak (any activity counts toward streak)
    // Non-blocking - fire and forget
    setTimeout(async () => {
      try {
        // Call the streak update endpoint via fetch
        // This will increment total_activities and handle streak logic
        const baseUrl = request.headers.get('origin') || 'http://localhost:3000';
        await fetch(`${baseUrl}/api/user/streak`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || '',
          },
          body: JSON.stringify({ activityType: type }),
        });
      } catch (error) {
        console.error('Error updating streak:', error);
        // Non-fatal, don't throw
      }
    }, 0);

    return NextResponse.json(
      {
        success: true,
        reaction: {
          id: reaction.id,
          type: reaction.type,
          createdAt: reaction.created_at,
        },
        counts: {
          roastCount: updatedPitch?.roast_count || pitch.roast_count,
          toastCount: updatedPitch?.toast_count || pitch.toast_count,
        },
      },
      { headers: formatRateLimitHeaders(result) }
    );
  } catch (error) {
    console.error('Error creating reaction:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create reaction',
      },
      {
        status: 500,
        headers: formatRateLimitHeaders(result),
      }
    );
  }
}
