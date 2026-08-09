-- Feedback inherits its pitch's visibility.
--
-- The 001 policy exposed every is_public feedback row to anon via PostgREST
-- regardless of the parent pitch's visibility — so privatizing event pitches
-- (20260808180000) left their reviewer notes publicly readable. Feedback is a
-- conversation about the pitch: whoever can see the pitch can see its public
-- feedback, and nobody else can.
--
-- Down migration (manual):
--   Recreate the 001 policy (is_public = true OR auth.uid() = user_id) and
--   drop can_view_pitch.

-- Mirrors the complete pitches SELECT surface: public visibility, owner,
-- event member/owner via the denormalized event, any submission event's
-- membership, and trusted reviewers with an explicit grant.
CREATE OR REPLACE FUNCTION public.can_view_pitch(target_pitch_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pitches p
    WHERE p.id = target_pitch_id
      AND p.status = 'published'
      AND p.deleted_at IS NULL
      AND (
        p.visibility = 'public'
        OR p.user_id = auth.uid()
        OR (
          p.event_id IS NOT NULL
          AND (
            public.is_pitch_event_member(p.event_id)
            OR public.is_pitch_event_owner(p.event_id)
          )
        )
        OR public.can_view_pitch_via_event_submission(p.id)
        OR public.can_trusted_reviewer_view_pitch(p.id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_pitch(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_pitch(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Public feedback is viewable by everyone" ON public.feedback;
CREATE POLICY "Public feedback is viewable by everyone"
  ON public.feedback FOR SELECT
  USING (
    auth.uid() = user_id
    OR (is_public = true AND public.can_view_pitch(pitch_id))
  );

COMMENT ON FUNCTION public.can_view_pitch(uuid) IS 'True when the caller may read the pitch under the pitches SELECT policies. Used to scope dependent rows (feedback) to the pitch''s visibility.';
