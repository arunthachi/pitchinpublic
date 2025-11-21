import { NextRequest, NextResponse } from 'next/server';
import { getVideoProvider } from '@/lib/video-providers';

/**
 * POST /api/videos/upload-url
 * Get a direct upload URL for client-side video uploads
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const maxDurationSeconds = body.maxDurationSeconds || 60; // Default 60s for pitches

    const provider = getVideoProvider();
    const result = await provider.getDirectUploadUrl({ maxDurationSeconds });

    return NextResponse.json({
      success: true,
      data: {
        uploadUrl: result.uploadUrl,
        videoId: result.videoId,
        provider: provider.name,
      },
    });
  } catch (error) {
    console.error('Error getting upload URL:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get upload URL',
      },
      { status: 500 }
    );
  }
}
