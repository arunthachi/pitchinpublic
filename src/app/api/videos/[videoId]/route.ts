import { NextRequest, NextResponse } from 'next/server';
import { getVideoProvider } from '@/lib/video-providers';
import { createRequestSupabase, createServiceSupabase } from '@/lib/admin';
import { rateLimit, RATE_LIMITS } from '@/lib/ratelimit';
import { signPrivateRows } from '@/lib/video-providers/sign-rows';

/**
 * GET /api/videos/[videoId] — processing status and playback URL for a video
 * the CALLER UPLOADED.
 *
 * This was unauthenticated and accepted any video id, returning the playback
 * and thumbnail URL for anyone's video. Video ids are embedded in thumbnail
 * URLs, so anyone who had loaded a pitch in the feed held an id permanently —
 * a wider hole than the one signed URLs set out to close, and one that made
 * signing pointless on its own.
 *
 * It is not dead code: the recorder polls it while a fresh upload processes.
 * So it is scoped to the uploader rather than removed, using the ownership
 * binding recorded when the upload URL was issued.
 *
 * Unknown and not-yours are both 404 — a 403 would confirm that an id exists.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
    if (!videoId) {
      return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 });
    }

    const supabase = createRequestSupabase(request);
    const serviceSupabase = createServiceSupabase();
    if (!supabase || !serviceSupabase) {
      return NextResponse.json(
        { success: false, error: 'Video lookup is not configured in this environment.', code: 'not_configured' },
        { status: 503 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required', code: 'unauthenticated' },
        { status: 401 }
      );
    }

    const { data: ownership, error: ownershipError } = await serviceSupabase
      .from('video_uploads')
      .select('user_id')
      .eq('video_id', videoId)
      .maybeSingle();

    if (ownershipError) {
      console.error('Video ownership lookup failed:', ownershipError);
      return NextResponse.json(
        { success: false, error: 'Could not load the video.', code: 'ownership_lookup_failed' },
        { status: 500 }
      );
    }

    if (!ownership || ownership.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 });
    }

    // The recorder polls this up to 30 times per upload and each call hits
    // Cloudflare's account-wide quota — the same one uploads depend on. Throttle
    // per user so one founder cannot exhaust it for everyone.
    const pollLimit = await rateLimit({
      key: `video-status:${user.id}`,
      limit: RATE_LIMITS.API.limit,
      window: RATE_LIMITS.API.window,
    });
    if (!pollLimit.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Try again shortly.', code: 'rate_limited' },
        { status: 429, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    const provider = getVideoProvider();
    const video = await provider.getVideo(videoId);

    if (!video) {
      return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 });
    }

    // The provider returns canonical URLs. That is correct while a video is
    // freshly uploaded and not yet attached to a pitch — the common case for
    // this endpoint. But once the video belongs to a PRIVATE pitch, playback is
    // enforced and a canonical URL 403s, so the recorder would show a broken
    // preview. Sign it in that case.
    const { data: owningPitch } = await serviceSupabase
      .from('pitches')
      .select('video_id,video_url,visibility')
      .eq('video_id', videoId)
      .eq('visibility', 'private')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    let data = video;
    if (owningPitch) {
      const signed = await signPrivateRows([owningPitch]);
      const urls = signed.get(videoId);
      if (urls) {
        data = { ...video, playbackUrl: urls.playbackUrl, thumbnailUrl: urls.thumbnailUrl };
      }
    }

    return NextResponse.json(
      { success: true, data },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('Error getting video:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get video',
      },
      { status: 500 }
    );
  }
}
