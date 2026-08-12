import type { SupabaseClient } from '@supabase/supabase-js';
import type { CachedStreamToken, SharedTokenStore } from './stream-tokens';

/**
 * Postgres-backed playback-token cache.
 *
 * Service-role only: a Stream token is a bearer capability for its video, so
 * the table has RLS enabled and no policy — every client is denied and only
 * this server path touches it.
 *
 * Its job is to bound minting for the whole deployment rather than per
 * serverless instance. Every read and write is best-effort: a failure here must
 * cost an extra mint, never a failed response.
 */
export function createSupabaseTokenStore(client: SupabaseClient): SharedTokenStore {
  return {
    async read(videoIds) {
      const found = new Map<string, CachedStreamToken>();
      if (!videoIds.length) return found;

      const { data, error } = await client
        .from('video_playback_tokens')
        .select('video_id,token,expires_at')
        .in('video_id', videoIds);

      if (error || !data) return found;

      for (const row of data) {
        const expiresAt = new Date(row.expires_at).getTime();
        if (!Number.isFinite(expiresAt)) continue;
        found.set(row.video_id, { token: row.token, expiresAt });
      }
      return found;
    },

    async write(videoId, entry) {
      await client.from('video_playback_tokens').upsert(
        {
          video_id: videoId,
          token: entry.token,
          expires_at: new Date(entry.expiresAt).toISOString(),
        },
        { onConflict: 'video_id' }
      );
    },
  };
}
