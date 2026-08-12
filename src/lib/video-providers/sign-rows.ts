import { createServiceSupabase } from '@/lib/admin';
import {
  requiresSignedPlayback,
  signedUrlsForRows,
  type SignableRow,
  type SignedVideoUrls,
} from './stream-tokens';
import { createSupabaseTokenStore } from './supabase-token-store';

/**
 * Sign the private videos in an already-authorized set of rows.
 *
 * Four surfaces need this — the feed, event pages, the review queue and the
 * practice panel — so the env plumbing and the shared token store live here
 * rather than being copied into each route and drifting.
 *
 * Call this only with rows that have already passed authorization: a token is
 * minted for whatever it is handed, and it inherits the caller's visibility
 * from the fact the row came back at all.
 */
export async function signPrivateRows(
  rows: SignableRow[]
): Promise<Map<string, SignedVideoUrls>> {
  const client = createServiceSupabase();
  return signedUrlsForRows(rows, {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    apiToken: process.env.CLOUDFLARE_STREAM_API_TOKEN || '',
    store: client ? createSupabaseTokenStore(client) : undefined,
  });
}

/**
 * Swap in signed URLs on one row, leaving public rows untouched so their links
 * stay permanent and shareable.
 *
 * Returns the same object when nothing changes, so callers can apply it to a
 * whole response without allocating.
 */
export function applySignedUrls<T extends SignableRow & Record<string, unknown>>(
  row: T,
  signed: Map<string, SignedVideoUrls>
): T {
  if (!requiresSignedPlayback(row)) return row;
  const urls = row.video_id ? signed.get(row.video_id) : undefined;
  if (!urls) return row;
  return { ...row, video_url: urls.playbackUrl, thumbnail_url: urls.thumbnailUrl };
}
