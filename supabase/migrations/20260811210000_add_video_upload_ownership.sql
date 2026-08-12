-- Bind every Cloudflare Stream video to the user who uploaded it.
--
-- Two live problems share this missing primitive:
--
-- 1. GET /api/videos/{videoId} is unauthenticated and returns the playback and
--    thumbnail URL for ANY video id. Video ids are embedded in thumbnail URLs,
--    so anyone who has loaded a pitch in the feed holds an id permanently. That
--    is a wider hole than the one signed URLs were meant to close, and it makes
--    signing pointless on its own. The endpoint is not dead code — the recorder
--    polls it for processing status — so it needs ownership, not deletion.
--
-- 2. POST /api/pitches accepts any videoId string. A caller can store someone
--    else's video id on their own pitch. Harmless while every video is publicly
--    playable, but once Phase 2 sets requireSignedURLs the server would mint a
--    valid playback token for a video the caller never uploaded.
--
-- Ownership is recorded when the upload URL is issued, which is the only moment
-- we know both the id and the user. Backfilled from existing pitches, where the
-- author is the uploader by construction.

CREATE TABLE IF NOT EXISTS public.video_uploads (
  video_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'cloudflare-stream',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS video_uploads_user_id_idx ON public.video_uploads (user_id);

ALTER TABLE public.video_uploads ENABLE ROW LEVEL SECURITY;

-- Readable only by the uploader. Everything that needs to act on someone else's
-- video (feed playback, organizer review) goes through the pitches policies,
-- never through this table.
DROP POLICY IF EXISTS "Uploaders can read their own video records" ON public.video_uploads;
CREATE POLICY "Uploaders can read their own video records"
  ON public.video_uploads FOR SELECT
  USING (auth.uid() = user_id);

-- Writes are service-role only: the upload route records the binding. A client
-- that could insert here could claim any video id and defeat the whole point.
REVOKE INSERT, UPDATE, DELETE ON public.video_uploads FROM authenticated, anon;

-- Backfill from existing pitches. DISTINCT ON keeps the earliest author if the
-- same video somehow appears twice, rather than failing the migration.
INSERT INTO public.video_uploads (video_id, user_id, provider, created_at)
SELECT DISTINCT ON (pitch.video_id)
  pitch.video_id,
  pitch.user_id,
  COALESCE(pitch.video_provider, 'cloudflare-stream'),
  pitch.created_at
FROM public.pitches AS pitch
WHERE pitch.video_id IS NOT NULL
  AND pitch.user_id IS NOT NULL
ORDER BY pitch.video_id, pitch.created_at ASC
ON CONFLICT (video_id) DO NOTHING;

COMMENT ON TABLE public.video_uploads IS
  'Maps a provider video id to the user who uploaded it. Recorded when the direct-upload URL is issued; the authority for "may this caller read or attach this video".';


-- Shared playback-token cache.
--
-- Tokens were cached in process only. Vercel runs one cache per warm instance,
-- so concurrent cold starts each re-mint every video in the response, and the
-- feed read path is not rate limited. That fans out into the account-wide
-- Cloudflare API quota (~1200 requests / 5 minutes) which is the SAME token
-- uploads and status polling use — so a burst of reads could lock founders out
-- of recording. Availability is part of the security boundary here.
--
-- Persisting the cache makes minting roughly one call per video per TTL for the
-- whole deployment rather than per instance. It also matters more in Phase 2,
-- where a failed mint is a black player rather than a graceful fallback.
--
-- Tokens are bearer capabilities, so this table is service-role only: no RLS
-- policy is defined, which with RLS enabled denies every client.

CREATE TABLE IF NOT EXISTS public.video_playback_tokens (
  video_id text PRIMARY KEY,
  token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS video_playback_tokens_expires_at_idx
  ON public.video_playback_tokens (expires_at);

ALTER TABLE public.video_playback_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.video_playback_tokens FROM authenticated, anon;

COMMENT ON TABLE public.video_playback_tokens IS
  'Deployment-wide cache of Cloudflare Stream playback tokens. Service-role only: a token is a bearer capability for its video. Bounds minting to ~1 call per video per TTL instead of per serverless instance.';
