import {
  VideoProvider,
  VideoUploadResult,
  VideoMetadata,
  UploadUrlResult,
  VideoAnalytics,
} from './types';

interface CloudflareConfig {
  accountId: string;
  apiToken: string;
}

interface CloudflareVideoResponse {
  uid: string;
  thumbnail: string;
  playback: {
    hls: string;
    dash: string;
  };
  duration: number;
  input: {
    width: number;
    height: number;
  };
  status: {
    state: string;
  };
  created: string;
}

export class CloudflareStreamProvider implements VideoProvider {
  readonly name = 'cloudflare-stream';
  private config: CloudflareConfig;
  private baseUrl: string;

  constructor(config?: Partial<CloudflareConfig>) {
    this.config = {
      accountId: config?.accountId || process.env.CLOUDFLARE_ACCOUNT_ID || '',
      apiToken: config?.apiToken || process.env.CLOUDFLARE_STREAM_API_TOKEN || '',
    };
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/stream`;
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.config.apiToken}`,
      'Content-Type': 'application/json',
    };
  }

  private mapStatus(state: string): 'processing' | 'ready' | 'error' {
    switch (state) {
      case 'ready':
        return 'ready';
      case 'error':
        return 'error';
      default:
        return 'processing';
    }
  }

  private mapToMetadata(video: CloudflareVideoResponse): VideoMetadata {
    return {
      id: video.uid,
      playbackUrl: video.playback.hls,
      thumbnailUrl: video.thumbnail,
      duration: video.duration,
      width: video.input?.width,
      height: video.input?.height,
      status: this.mapStatus(video.status.state),
      createdAt: video.created,
    };
  }

  async getDirectUploadUrl(metadata?: { maxDurationSeconds?: number }): Promise<UploadUrlResult> {
    const body: Record<string, unknown> = {
      maxDurationSeconds: metadata?.maxDurationSeconds || 60, // Default 60s for pitches
    };

    const response = await fetch(`${this.baseUrl}/direct_upload`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get upload URL: ${error}`);
    }

    const data = await response.json();

    return {
      uploadUrl: data.result.uploadURL,
      videoId: data.result.uid,
    };
  }

  async uploadFromUrl(url: string): Promise<VideoUploadResult> {
    const response = await fetch(`${this.baseUrl}/copy`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to upload from URL: ${error}`);
    }

    const data = await response.json();
    const video = data.result as CloudflareVideoResponse;

    return {
      id: video.uid,
      playbackUrl: video.playback?.hls || '',
      thumbnailUrl: video.thumbnail,
      duration: video.duration,
      status: this.mapStatus(video.status.state),
    };
  }

  async getVideo(videoId: string): Promise<VideoMetadata | null> {
    const response = await fetch(`${this.baseUrl}/${videoId}`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const error = await response.text();
      throw new Error(`Failed to get video: ${error}`);
    }

    const data = await response.json();
    return this.mapToMetadata(data.result);
  }

  async deleteVideo(videoId: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/${videoId}`, {
      method: 'DELETE',
      headers: this.headers,
    });

    return response.ok;
  }

  async getAnalytics(videoId: string): Promise<VideoAnalytics | null> {
    // Cloudflare Stream analytics requires GraphQL API
    // This is a simplified version - full implementation would use their GraphQL endpoint
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/stream/analytics/views?videoIds=${videoId}`,
      {
        method: 'GET',
        headers: this.headers,
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const totals = data.result?.totals;

    if (!totals) {
      return null;
    }

    return {
      views: totals.views || 0,
      watchTimeSeconds: totals.watchTimeSeconds || 0,
      completionRate: totals.avgViewDurationPercentage || 0,
    };
  }

  async getSignedPlaybackUrl(videoId: string, expiresInSeconds: number = 3600): Promise<string> {
    // For signed URLs, you need to set up signed URL tokens in Cloudflare dashboard
    // This returns the standard HLS URL - implement signing if needed
    const video = await this.getVideo(videoId);
    if (!video) {
      throw new Error('Video not found');
    }
    return video.playbackUrl;
  }
}
