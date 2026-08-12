import { NextRequest, NextResponse } from 'next/server';
import { getVideoProvider } from '@/lib/video-providers';
import { createRequestSupabase, createServiceSupabase } from '@/lib/admin';

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

    const provider = getVideoProvider();
    const video = await provider.getVideo(videoId);

    if (!video) {
      return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 });
    }

    return NextResponse.json(
      { success: true, data: video },
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
