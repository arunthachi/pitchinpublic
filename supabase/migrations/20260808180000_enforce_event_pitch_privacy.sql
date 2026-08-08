-- Event pitches are private to their event by default.
--
-- Context: pitches.visibility has existed since 009 (default 'public') and the
-- SELECT policy has required visibility='public' since the trusted-reviewers
-- migration — but no app code ever set the column, and pitches carried no
-- event association at all, so every event recording landed fully public and
-- appeared in the public feed. This migration adds the event association,
-- keeps public reads at visibility='public', adds an event-member read path,
-- and applies the approved backfill so already-submitted event pitches become
-- private. Founders explicitly promote takes to the public feed via the
-- visibility control.
--
-- Down migration (manual):
--   Drop "Event members can view event pitches"; recreate the public-read
--   policy from 20260722223000; ALTER TABLE pitches DROP COLUMN event_id.
--   The backfill and stranded-assignment cleanup are intentionally not
--   mechanically reversible: re-exposure must be a founder decision via the
--   visibility control, not a rollback side effect.

-- 0. The event association column (pitches had none — the nudge_events
--    event_id from migration 020 is a different table).
ALTER TABLE public.pitches
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.pitch_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pitches_event
  ON public.pitches (event_id)
  WHERE event_id IS NOT NULL;

-- 1. Public reads stay at explicit visibility='public' (unchanged from the
--    trusted-reviewers policy — this migration must not widen anon access;
--    'unlisted' remains unused by the application). Drop every historical
--    policy alias defensively, as prior hardening migrations do.
DROP POLICY IF EXISTS "Pitches are viewable by everyone" ON public.pitches;
DROP POLICY IF EXISTS "Published pitches are viewable by everyone" ON public.pitches;
DROP POLICY IF EXISTS "Published active pitches are viewable by everyone" ON public.pitches;
CREATE POLICY "Published active pitches are viewable by everyone"
  ON public.pitches FOR SELECT
  USING (
    status = 'published'
    AND deleted_at IS NULL
    AND visibility = 'public'
  );

-- 2. Active event members and team (any role) plus the event owner can read
--    the event's pitches regardless of visibility. A pitch submitted to
--    multiple events stays readable through EVERY submission's event, not
--    only the one denormalized on pitches.event_id. Owner reads are already
--    covered by "Users can view their own pitches".
CREATE OR REPLACE FUNCTION public.can_view_pitch_via_event_submission(target_pitch_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pitch_event_submissions s
    JOIN public.pitch_event_participants pep
      ON pep.event_id = s.event_id
     AND pep.user_id = auth.uid()
     AND pep.status = 'active'
    WHERE s.pitch_id = target_pitch_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.pitch_event_submissions s
    JOIN public.pitch_events pe
      ON pe.id = s.event_id
     AND pe.organizer_id = auth.uid()
    WHERE s.pitch_id = target_pitch_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_pitch_via_event_submission(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Event members can view event pitches" ON public.pitches;
CREATE POLICY "Event members can view event pitches"
  ON public.pitches FOR SELECT
  USING (
    status = 'published'
    AND deleted_at IS NULL
    AND (
      (
        event_id IS NOT NULL
        AND (
          public.is_pitch_event_member(event_id)
          OR public.is_pitch_event_owner(event_id)
        )
      )
      OR public.can_view_pitch_via_event_submission(id)
    )
  );

-- 3. Backfill: pitches already submitted to an event become private to that
--    event. Only currently-public rows are touched; when a pitch was
--    submitted to multiple events, the most recent submission wins
--    deterministically. Founders re-share intentionally through the
--    visibility control. (Approved 2026-08-08.)
UPDATE public.pitches AS p
SET
  visibility = 'private',
  event_id = COALESCE(p.event_id, s.event_id)
FROM (
  SELECT DISTINCT ON (pitch_id) pitch_id, event_id
  FROM public.pitch_event_submissions
  ORDER BY pitch_id, submitted_at DESC NULLS LAST
) AS s
WHERE s.pitch_id = p.id
  AND p.deleted_at IS NULL
  AND p.visibility = 'public';

-- 4. Queue hygiene: open review assignments pointing at a pitch this backfill
--    privatized would silently vanish from non-member reviewers' queues
--    (RLS drops the join) while still counting in their badge. Delete the
--    assignments those reviewers can no longer act on; event members keep
--    theirs. The status CHECK has no cancelled state and pending/started rows
--    carry no completed feedback, so deletion is the clean form.
DELETE FROM public.review_assignments AS ra
USING public.pitches AS p
WHERE ra.pitch_id = p.id
  AND ra.status IN ('pending', 'started')
  AND p.visibility = 'private'
  AND p.event_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.pitch_event_participants AS pep
    WHERE pep.event_id = p.event_id
      AND pep.user_id = ra.reviewer_user_id
      AND pep.status = 'active'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.pitch_events AS pe
    WHERE pe.id = p.event_id
      AND pe.organizer_id = ra.reviewer_user_id
  )
  -- Reviewers reachable through ANY submission event keep their assignments
  -- (multi-event pitches remain reviewable via each event's membership).
  AND NOT EXISTS (
    SELECT 1
    FROM public.pitch_event_submissions AS s
    JOIN public.pitch_event_participants AS pep
      ON pep.event_id = s.event_id
     AND pep.user_id = ra.reviewer_user_id
     AND pep.status = 'active'
    WHERE s.pitch_id = p.id
  );

-- 5. Feed-shaped partial index for the listing predicate.
CREATE INDEX IF NOT EXISTS idx_pitches_public_feed
  ON public.pitches (created_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL AND visibility = 'public';

COMMENT ON COLUMN public.pitches.visibility IS 'public: in the feed; unlisted: reserved, unused; private: owner and (when event_id is set) active event members/team only.';
COMMENT ON COLUMN public.pitches.event_id IS 'Event this take was recorded for or submitted to. Drives the event-member read path in RLS.';
