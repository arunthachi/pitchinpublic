-- Event pitches are private to their event by default.
--
-- Before this migration the pitches SELECT policy ignored the visibility
-- column entirely, so pitches recorded for invite-only events were publicly
-- readable and appeared in the public feed. Public reads now require public
-- or unlisted visibility; private event pitches are readable only by their
-- owner and the event's active members/team (via the existing
-- security-definer helpers), and founders explicitly promote a pitch to the
-- public feed when they choose.
--
-- Down migration (manual):
--   Recreate the previous SELECT policy without the visibility conditions and
--   drop "Event members can view event pitches". The backfill is not
--   reversible mechanically (prior visibility values are overwritten), which
--   is intentional: re-exposure should be a founder decision via the
--   visibility control, not a rollback side effect.

-- 1. Public reads respect visibility. 'unlisted' stays reachable by direct
--    link (pitch pages) but the feed API additionally restricts listings to
--    'public'.
DROP POLICY IF EXISTS "Published active pitches are viewable by everyone" ON public.pitches;
CREATE POLICY "Published active pitches are viewable by everyone"
  ON public.pitches FOR SELECT
  USING (
    status = 'published'
    AND deleted_at IS NULL
    AND visibility IN ('public', 'unlisted')
  );

-- 2. Active event members and team (any role) plus the event owner can read
--    the event's pitches regardless of visibility. Owner reads are already
--    covered by "Users can view their own pitches".
DROP POLICY IF EXISTS "Event members can view event pitches" ON public.pitches;
CREATE POLICY "Event members can view event pitches"
  ON public.pitches FOR SELECT
  USING (
    status = 'published'
    AND deleted_at IS NULL
    AND event_id IS NOT NULL
    AND (
      public.is_pitch_event_member(event_id)
      OR public.is_pitch_event_owner(event_id)
    )
  );

-- 3. Backfill: pitches already submitted to an event become private to that
--    event. Only currently-public rows are touched; founders re-share
--    intentionally through the visibility control. (Approved 2026-08-08.)
UPDATE public.pitches AS p
SET
  visibility = 'private',
  event_id = COALESCE(p.event_id, s.event_id)
FROM public.pitch_event_submissions AS s
WHERE s.pitch_id = p.id
  AND p.deleted_at IS NULL
  AND p.visibility = 'public';

-- 4. Feed-shaped partial index for the now-stricter listing predicate.
CREATE INDEX IF NOT EXISTS idx_pitches_public_feed
  ON public.pitches (created_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL AND visibility = 'public';

COMMENT ON COLUMN public.pitches.visibility IS 'public: in the feed; unlisted: direct link only; private: owner and (when event_id is set) active event members/team only.';
