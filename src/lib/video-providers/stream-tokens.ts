/**
 * Signed playback for Cloudflare Stream.
 *
 * Every pitch video is served from an unsigned URL today, so anyone who saved
 * that URL while a pitch was public can still play it after the founder makes
 * it private. RLS protects the pitch ROW; it has never protected the video.
 *
 * Tokens are minted by Cloudflare using the API token this app already has —
 * deliberately no new signing key. Local RSA signing avoids a round-trip, but
 * with 14 videos and a two-hour TTL the cache makes that round-trip a rounding
 * error, and a second private credential to create, store and rotate is a real
 * cost. See the cache below.
 *
 * Server-only.
 *
 * PHASE 1 (this module): signed URLs work while videos remain publicly
 * playable, so the path is proven before anything can break. A mint failure
 * falls back to the stored unsigned URL — a Cloudflare blip degrades to today's
 * behaviour rather than a black player.
 *
 * PHASE 2 (separate, gated): set requireSignedURLs on the videos. That is what
 * actually closes the hole, and it is a one-way door for every URL in the wild.
 */

/** Long enough to watch and re-watch; short enough that a leaked URL dies. */
export const STREAM_TOKEN_TTL_SECONDS = 2 * 60 * 60;

/**
 * Re-mint this long before expiry so a token handed to a client is never about
 * to die mid-playback.
 */
export const STREAM_TOKEN_REFRESH_MARGIN_SECONDS = 10 * 60;

/**
 * The feed awaits minting, so a hanging Cloudflare call would hold the whole
 * response open. Abandon quickly and fall back to the stored URL instead.
 */
export const STREAM_TOKEN_TIMEOUT_MS = 2_500;

/**
 * Hard ceiling on mints for a single response. The shared cache makes a cold
 * fan-out rare, but if the store is unavailable this is what stops one request
 * from issuing a hundred Cloudflare calls. Anything beyond the cap keeps its
 * stored URL, which Phase 1 already treats as the graceful path.
 */
export const STREAM_MAX_MINTS_PER_REQUEST = 12;

export type CachedStreamToken = {
  token: string;
  /** Epoch ms when Cloudflare stops honouring it. */
  expiresAt: number;
};

/**
 * Usable means "valid now AND not about to expire" — handing over a token with
 * seconds left would break playback partway through a pitch.
 */
export function isCachedTokenUsable(
  entry: CachedStreamToken | undefined,
  now: number
): entry is CachedStreamToken {
  if (!entry?.token) return false;
  if (!Number.isFinite(entry.expiresAt)) return false;
  return entry.expiresAt - now > STREAM_TOKEN_REFRESH_MARGIN_SECONDS * 1000;
}

/**
 * The delivery subdomain is already embedded in every URL Cloudflare has handed
 * us, so it is recovered from stored data rather than added as new config.
 */
export function customerSubdomainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = /https:\/\/(customer-[a-z0-9]+)\.cloudflarestream\.com\//i.exec(url);
  return match ? match[1] : null;
}

export type SignedVideoUrls = { playbackUrl: string; thumbnailUrl: string };

/**
 * Build the tokenized URLs. The thumbnail is signed too: it sits on the same
 * host and is exactly as exposed as the manifest.
 */
export function buildSignedVideoUrls(subdomain: string, token: string): SignedVideoUrls {
  const base = `https://${subdomain}.cloudflarestream.com/${token}`;
  return {
    playbackUrl: `${base}/manifest/video.m3u8`,
    thumbnailUrl: `${base}/thumbnails/thumbnail.jpg`,
  };
}

/**
 * A shared store so minting is bounded per DEPLOYMENT, not per serverless
 * instance. Without it, concurrent cold starts each re-mint every video in a
 * response and fan out into the account-wide Cloudflare quota — the same quota
 * uploads use, so a burst of reads can lock founders out of recording.
 */
export type SharedTokenStore = {
  read: (videoIds: string[]) => Promise<Map<string, CachedStreamToken>>;
  write: (videoId: string, entry: CachedStreamToken) => Promise<void>;
};

type MintDeps = {
  accountId: string;
  apiToken: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  store?: SharedTokenStore;
};

/**
 * Module-scoped cache. Vercel runs one of these per warm instance, so a cold
 * start simply re-mints — correctness never depends on the cache, only call
 * volume does.
 */
const tokenCache = new Map<string, CachedStreamToken>();
/** Collapses concurrent misses for the same video into one Cloudflare call. */
const inFlight = new Map<string, Promise<CachedStreamToken | null>>();

export function __resetStreamTokenCacheForTests() {
  tokenCache.clear();
  inFlight.clear();
}

async function requestToken(videoId: string, deps: MintDeps): Promise<CachedStreamToken | null> {
  const doFetch = deps.fetchImpl ?? fetch;
  const now = (deps.now ?? Date.now)();
  const expSeconds = Math.floor(now / 1000) + STREAM_TOKEN_TTL_SECONDS;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), deps.timeoutMs ?? STREAM_TOKEN_TIMEOUT_MS);

  try {
    const response = await doFetch(
      `https://api.cloudflare.com/client/v4/accounts/${deps.accountId}/stream/${videoId}/token`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${deps.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ exp: expSeconds }),
        signal: abort.signal,
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const token = data?.result?.token;
    if (typeof token !== 'string' || !token) return null;
    return { token, expiresAt: expSeconds * 1000 };
  } catch {
    // Fail closed on the token, open on the URL: the caller keeps today's
    // unsigned URL rather than rendering a player that cannot load. Covers the
    // timeout abort as well as network and parse failures.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A cached Cloudflare-minted token for one video, or null when it could not be
 * minted. Callers must treat null as "use the stored URL".
 */
export async function getStreamToken(
  videoId: string,
  deps: MintDeps
): Promise<CachedStreamToken | null> {
  if (!videoId || !deps.accountId || !deps.apiToken) return null;

  const now = (deps.now ?? Date.now)();
  const cached = tokenCache.get(videoId);
  if (isCachedTokenUsable(cached, now)) return cached;

  const pending = inFlight.get(videoId);
  if (pending) return pending;

  const request = (async () => {
    // Another instance may already have minted this one.
    if (deps.store) {
      try {
        const shared = await deps.store.read([videoId]);
        const entry = shared.get(videoId);
        if (isCachedTokenUsable(entry, now)) return entry;
      } catch {
        // A cache miss is never fatal; fall through to minting.
      }
    }
    const minted = await requestToken(videoId, deps);
    if (minted && deps.store) {
      try {
        await deps.store.write(videoId, minted);
      } catch {
        // Losing the write only costs an extra mint later.
      }
    }
    return minted;
  })()
    .then((entry) => {
      if (entry) tokenCache.set(videoId, entry);
      return entry;
    })
    .finally(() => {
      inFlight.delete(videoId);
    });

  inFlight.set(videoId, request);
  return request;
}

export type SignableRow = {
  video_id?: string | null;
  video_url?: string | null;
  /** Only 'private' rows are signed. Anything else keeps its canonical URL. */
  visibility?: string | null;
};

/**
 * Signing is bound to visibility, not applied blanket.
 *
 * A public pitch is public: its URL should be permanent and shareable, so a
 * founder can post their best take to LinkedIn and have it still render next
 * month. Signing those would hand out links that die in two hours.
 *
 * A private pitch is the case this exists for: the URL must be short-lived and
 * revocable, so that flipping a pitch private actually stops the copies already
 * in circulation from playing.
 */
export function requiresSignedPlayback(row: SignableRow): boolean {
  return row.visibility === 'private';
}

/**
 * Signed URLs for every distinct video in a set of already-authorized rows.
 *
 * Called with rows that came back through RLS, so the token inherits exactly
 * the visibility the row was granted under — there is no second copy of the
 * authorization rules to drift out of sync.
 *
 * Rows whose token could not be minted are simply absent from the map, and the
 * caller keeps the stored URL.
 */
export async function signedUrlsForRows(
  rows: SignableRow[],
  deps: MintDeps & { subdomain?: string | null }
): Promise<Map<string, SignedVideoUrls>> {
  const signed = new Map<string, SignedVideoUrls>();
  if (!deps.accountId || !deps.apiToken) return signed;

  // Derive from any row, not just the ones being signed: a response may hold a
  // single private pitch whose stored URL is missing while public rows carry it.
  const subdomain =
    deps.subdomain ||
    rows.map((row) => customerSubdomainFromUrl(row.video_url)).find(Boolean) ||
    null;
  if (!subdomain) return signed;

  const videoIds = Array.from(
    new Set(
      rows
        .filter(requiresSignedPlayback)
        .map((row) => row.video_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  if (!videoIds.length) return signed;

  // One batched read for the whole response, so a cold instance costs a single
  // round-trip rather than one per video.
  if (deps.store) {
    try {
      const now = (deps.now ?? Date.now)();
      const shared = await deps.store.read(videoIds);
      for (const [videoId, entry] of shared) {
        if (isCachedTokenUsable(entry, now)) tokenCache.set(videoId, entry);
      }
    } catch {
      // Fall through: every id is simply treated as a miss.
    }
  }

  // Cached ids are free; only genuine misses count against the ceiling.
  const now = (deps.now ?? Date.now)();
  const misses = videoIds.filter((id) => !isCachedTokenUsable(tokenCache.get(id), now));
  const allowed = new Set([
    ...videoIds.filter((id) => !misses.includes(id)),
    ...misses.slice(0, STREAM_MAX_MINTS_PER_REQUEST),
  ]);

  const entries = await Promise.all(
    Array.from(allowed).map(
      async (videoId) => [videoId, await getStreamToken(videoId, deps)] as const
    )
  );

  for (const [videoId, entry] of entries) {
    if (entry) signed.set(videoId, buildSignedVideoUrls(subdomain, entry.token));
  }
  return signed;
}
