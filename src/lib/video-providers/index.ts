/**
 * Video Provider Factory
 *
 * Usage:
 *   import { getVideoProvider } from '@/lib/video-providers';
 *   const provider = getVideoProvider();
 *   const { uploadUrl, videoId } = await provider.getDirectUploadUrl();
 *
 * To switch providers, change VIDEO_PROVIDER env variable or pass provider name.
 */

export * from './types';
export { CloudflareStreamProvider } from './cloudflare-stream';

import { VideoProvider } from './types';
import { CloudflareStreamProvider } from './cloudflare-stream';

type ProviderName = 'cloudflare' | 'mux' | 'bunny';

const providers: Record<ProviderName, () => VideoProvider> = {
  cloudflare: () => new CloudflareStreamProvider(),
  // Future providers can be added here:
  // mux: () => new MuxProvider(),
  // bunny: () => new BunnyStreamProvider(),
  mux: () => { throw new Error('Mux provider not implemented yet'); },
  bunny: () => { throw new Error('Bunny provider not implemented yet'); },
};

let cachedProvider: VideoProvider | null = null;

/**
 * Get the configured video provider
 * Defaults to Cloudflare Stream
 */
export function getVideoProvider(providerName?: ProviderName): VideoProvider {
  const name = providerName || (process.env.VIDEO_PROVIDER as ProviderName) || 'cloudflare';

  if (!cachedProvider || cachedProvider.name !== `${name}-stream`) {
    const factory = providers[name];
    if (!factory) {
      throw new Error(`Unknown video provider: ${name}. Available: ${Object.keys(providers).join(', ')}`);
    }
    cachedProvider = factory();
  }

  return cachedProvider;
}

/**
 * Clear the cached provider (useful for testing)
 */
export function clearProviderCache(): void {
  cachedProvider = null;
}
