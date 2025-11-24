import { NextRequest, NextResponse } from 'next/server';
import { getVideoProvider } from '@/lib/video-providers';
import { rateLimit, getClientIp, RATE_LIMITS, formatRateLimitHeaders } from '@/lib/ratelimit';

/**
 * POST /api/videos/upload-url
 * Get a direct upload URL for client-side video uploads
 *
 * Rate Limited: 10 requests per hour per IP address
 *
 * Request body:
 * {
 *   "maxDurationSeconds": 60  // Optional, default 60
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "uploadUrl": "https://...",
 *     "videoId": "...",
 *     "provider": "mux"
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // Apply rate limiting: 10 requests per hour per IP
  const result = await rateLimit({
    key: ip,
    limit: RATE_LIMITS.UPLOAD.limit,
    window: RATE_LIMITS.UPLOAD.window,
  });

  // Check if rate limit exceeded
  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many upload requests. Please try again later.',
        retryAfter: result.retryAfter,
      },
      {
        status: 429, // Too Many Requests
        headers: formatRateLimitHeaders(result),
      }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const maxDurationSeconds = body.maxDurationSeconds || 60; // Default 60s for pitches

    const provider = getVideoProvider();
    const uploadUrlResult = await provider.getDirectUploadUrl({ maxDurationSeconds });

    return NextResponse.json(
      {
        success: true,
        data: {
          uploadUrl: uploadUrlResult.uploadUrl,
          videoId: uploadUrlResult.videoId,
          provider: provider.name,
        },
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
