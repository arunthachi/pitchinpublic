-- Make the peer/team distinction usable by the thing that consumes it.
--
-- 20260811060000 tagged peer reviews 'cohort_peer_feedback' and claimed
-- organizer coverage kept its meaning. It did not: get_event_review_assignments
-- never returned assignment_reason, so the dashboard counted every submitted
-- assignment alike and peer feedback silently satisfied the organizer's review
-- target. An organizer who set "3 reviews per pitch" would stop chasing their
-- judges because the cohort had chatted.
--
-- Returning the reason lets coverage keep counting exactly what it counted
-- before peer feedback existed, and report peer activity as its own number.
--
-- The return type changes, so this drops and recreates rather than replacing.
-- Reversible: the previous definition lives in 20260805170000.

DROP FUNCTION IF EXISTS public.get_event_review_assignments(uuid);

CREATE FUNCTION public.get_event_review_assignments(target_event_id uuid)
RETURNS TABLE(
  id uuid,
  pitch_id uuid,
  status text,
  completed_feedback_id uuid,
  completed_at timestamp with time zone,
  assignment_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
BEGIN
  IF NOT public.can_view_event_review_workspace(target_event_id) THEN
    RAISE EXCEPTION 'Not authorized to view event review coverage';
  END IF;

  RETURN QUERY
  SELECT assignment.id,
    assignment.pitch_id,
    assignment.status::text,
    assignment.completed_feedback_id,
    assignment.completed_at,
    assignment.assignment_reason::text
  FROM public.review_assignments AS assignment
  WHERE assignment.event_id = target_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_event_review_assignments(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_review_assignments(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_event_review_assignments(uuid) IS
  'Event review assignments for the organizer workspace, including assignment_reason so peer feedback can be counted separately from the organizer''s own review programme.';
