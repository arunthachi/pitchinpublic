/**
 * Abstract Video Provider Interface
 * Allows easy switching between video hosting providers (Cloudflare, Mux, Bunny, etc.)
 */

export interface VideoUploadResult {
  id: string;
  playbackUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  status: 'processing' | 'ready' | 'error';
}

export interface VideoMetadata {
  id: string;
  playbackUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
  status: 'processing' | 'ready' | 'error';
  createdAt?: string;
}

export interface UploadUrlResult {
  uploadUrl: string;
  videoId: string;
}

export interface VideoAnalytics {
  views: number;
  watchTimeSeconds: number;
  completionRate: number;
}

export interface VideoProvider {
  /**
   * Provider name for identification
   */
  readonly name: string;

  /**
   * Get a direct upload URL for client-side uploads
   * This is the recommended approach for large files
   */
  getDirectUploadUrl(metadata?: { maxDurationSeconds?: number }): Promise<UploadUrlResult>;

  /**
   * Upload video from server-side (for smaller files or URL imports)
   */
  uploadFromUrl(url: string): Promise<VideoUploadResult>;

  /**
   * Get video metadata and playback URL
   */
  getVideo(videoId: string): Promise<VideoMetadata | null>;

  /**
   * Delete a video
   */
  deleteVideo(videoId: string): Promise<boolean>;

  /**
   * Get video analytics (if supported)
   */
  getAnalytics?(videoId: string): Promise<VideoAnalytics | null>;

  /**
   * Generate a signed playback URL (for private videos)
   */
  getSignedPlaybackUrl?(videoId: string, expiresInSeconds?: number): Promise<string>;
}
