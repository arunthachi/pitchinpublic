import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getVideoProvider } from '@/lib/video-providers';
import { rateLimit, getClientIp, RATE_LIMITS, formatRateLimitHeaders } from '@/lib/ratelimit';

/**
 * GET /api/pitches/upload-url
 * Get a direct upload URL from Cloudflare Stream for client-side video upload
 *
 * Rate Limited: 10 requests per hour per IP
 *
 * Response:
 * {
 *   "success": true,
 *   "uploadUrl": "string",
 *   "videoId": "string"
 * }
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);

  // Apply rate limiting: 10 requests per hour per IP
  const result = await rateLimit({
    key: ip,
    limit: RATE_LIMITS.UPLOAD.limit,
    window: RATE_LIMITS.UPLOAD.window,
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

    const provider = getVideoProvider();
    const uploadUrlResult = await provider.getDirectUploadUrl({
      maxDurationSeconds: 60,
    });

    return NextResponse.json(
      {
        success: true,
        uploadUrl: uploadUrlResult.uploadUrl,
        videoId: uploadUrlResult.videoId,
        provider: provider.name,
      },
      {
        headers: formatRateLimitHeaders(result),
      }
    );
  } catch (error) {
    console.error('Error getting upload URL:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get upload URL',
      },
      {
        status: 500,
        headers: formatRateLimitHeaders(result),
      }
    );
  }
}
