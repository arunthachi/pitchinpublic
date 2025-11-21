import { NextRequest, NextResponse } from 'next/server';
import { getVideoProvider } from '@/lib/video-providers';

/**
 * GET /api/videos/[videoId]
 * Get video metadata and playback URL
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
    const provider = getVideoProvider();
    const video = await provider.getVideo(videoId);

    if (!video) {
      return NextResponse.json(
        { success: false, error: 'Video not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: video,
    });
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

/**
 * DELETE /api/videos/[videoId]
 * Delete a video
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
    const provider = getVideoProvider();
    const success = await provider.deleteVideo(videoId);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete video' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting video:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete video',
      },
      { status: 500 }
    );
  }
}
