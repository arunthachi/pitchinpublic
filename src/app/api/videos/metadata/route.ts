import { NextRequest, NextResponse } from 'next/server';
import { getVideoProvider } from '@/lib/video-providers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId parameter is required' },
        { status: 400 }
      );
    }

    const provider = getVideoProvider();
    const metadata = await provider.getVideo(videoId);

    if (!metadata) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      metadata: {
        id: metadata.id,
        playbackUrl: metadata.playbackUrl,
        thumbnailUrl: metadata.thumbnailUrl,
        duration: metadata.duration,
        status: metadata.status,
      },
    });
  } catch (error) {
    console.error('Error fetching video metadata:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch video metadata',
      },
      { status: 500 }
    );
  }
}
