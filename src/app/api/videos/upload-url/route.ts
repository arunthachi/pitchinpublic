import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getVideoProvider } from '@/lib/video-providers';
import { createServiceSupabase } from '@/lib/admin';
import { videoUploadSchema } from '@/lib/validation';
import { rateLimit, getClientIp, RATE_LIMITS, formatRateLimitHeaders } from '@/lib/ratelimit';
import { INVITE_ONLY_MESSAGE, isUserAllowedForPilot } from '@/lib/pilot-access';

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

    const body = await request.json().catch(() => ({}));
    const validation = videoUploadSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Upload settings are invalid.',
        },
        {
          status: 400,
          headers: formatRateLimitHeaders(result),
        }
      );
    }
    const maxDurationSeconds = Math.min(validation.data.maxDurationSeconds, 180);

    const provider = getVideoProvider();
    const uploadUrlResult = await provider.getDirectUploadUrl({ maxDurationSeconds });

    // Record who this video belongs to at the only moment we know both the id
    // and the user. Everything downstream — reading its status, attaching it to
    // a pitch, minting a playback token — checks this binding.
    const serviceSupabase = createServiceSupabase();
    if (!serviceSupabase) {
      // No binding can be recorded, so the resulting id could never be read or
      // attached — and POST would have nothing to verify against.
      console.error('Upload ownership unavailable: no service client');
      return NextResponse.json(
        { success: false, error: 'Uploads are temporarily unavailable.', code: 'ownership_unavailable' },
        { status: 503, headers: formatRateLimitHeaders(result) }
      );
    }
    {
      const { error: ownershipError } = await serviceSupabase
        .from('video_uploads')
        .upsert(
          { video_id: uploadUrlResult.videoId, user_id: user.id, provider: provider.name },
          { onConflict: 'video_id' }
        );
      if (ownershipError) {
        // Without the binding the upload cannot later be read or attached, so
        // fail here rather than hand back an id that is orphaned by design.
        console.error('Video ownership record failed:', ownershipError);
        return NextResponse.json(
          { success: false, error: 'Could not start the upload. Try again.', code: 'ownership_record_failed' },
          { status: 500, headers: formatRateLimitHeaders(result) }
        );
      }
    }

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
