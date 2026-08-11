-- Cohort peer feedback: let an active event member give feedback on a cohort
-- take without an organizer pre-assigning them.
--
-- First principles: membership is already the boundary. Migration
-- 20260808180000 lets active members WATCH cohort takes, which is the more
-- sensitive permission; commenting is strictly less so. The previous design
-- admitted only team roles (organizer/admin/coach/mentor/judge) plus holders of
-- a pre-built review assignment, which left peer founders — the majority of a
-- cohort — unable to respond to anything they could see.
--
-- What this does NOT do: it does not introduce a "claim" step. Feedback already
-- creates its own assignment row at submit time (see 'event_team_feedback'
-- below, unchanged behaviour since 20260805170000), and the AFTER INSERT
-- trigger process_submitted_review marks it submitted in the same transaction.
-- So no row ever sits pending, nothing appears in /api/reviews/queue as
-- outstanding work, and organizer coverage keeps its meaning. The assignment is
-- the event binding for feedback — feedback has no event_id of its own.
--
-- Provenance: peer reviews are tagged 'cohort_peer_feedback' so coverage can
-- distinguish them from organizer-side 'event_team_feedback'.
--
-- Organizer control: peer_feedback_enabled defaults TRUE (a feedback circle),
-- and an organizer running a competition can turn it off. Archived events are
-- always closed to new feedback.

ALTER TABLE public.pitch_events
  ADD COLUMN IF NOT EXISTS peer_feedback_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.pitch_events.peer_feedback_enabled IS
  'When true (default) active participants of any role may give feedback on cohort takes. Off for competitions where peer review is a conflict of interest.';

CREATE OR REPLACE FUNCTION public.submit_event_pitch_feedback(
  target_pitch_id uuid,
  feedback_type text,
  feedback_content text,
  request_key uuid,
  target_event_id uuid
)
RETURNS TABLE(
  feedback_id uuid,
  submitted_type text,
  reviewer_role text,
  created_at timestamp with time zone,
  assignment_completed boolean,
  idempotent_replay boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  pitch_owner_id uuid;
  content_json jsonb;
  matched_assignment public.review_assignments;
  saved_feedback public.feedback;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_pilot_user() THEN
    RAISE EXCEPTION 'Invite-only pilot access is required';
  END IF;
  IF request_key IS NULL OR target_event_id IS NULL THEN
    RAISE EXCEPTION 'A submission key and event are required';
  END IF;
  IF feedback_type IS NULL OR feedback_type NOT IN ('roast', 'toast') THEN
    RAISE EXCEPTION 'Invalid feedback type';
  END IF;

  BEGIN
    content_json := feedback_content::jsonb;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Feedback content must be valid JSON';
  END;

  IF jsonb_typeof(content_json) IS DISTINCT FROM 'object'
     OR jsonb_typeof(content_json->'notes') IS DISTINCT FROM 'string'
     OR char_length(content_json->>'notes') > 2000 THEN
    RAISE EXCEPTION 'Feedback content failed validation';
  END IF;
  IF jsonb_typeof(content_json->'readiness') IS DISTINCT FROM 'number'
     OR (content_json->>'readiness')::numeric NOT BETWEEN 1 AND 4
     OR trunc((content_json->>'readiness')::numeric) <> (content_json->>'readiness')::numeric THEN
    RAISE EXCEPTION 'Feedback content failed validation';
  END IF;
  IF jsonb_typeof(content_json->'signals') IS DISTINCT FROM 'array'
     OR jsonb_array_length(content_json->'signals') NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'Feedback content failed validation';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(content_json->'signals') AS signal(value)
    WHERE jsonb_typeof(value) IS DISTINCT FROM 'string'
       OR char_length(trim(value #>> '{}')) NOT BETWEEN 2 AND 80
  ) THEN
    RAISE EXCEPTION 'Feedback content failed validation';
  END IF;
  IF jsonb_typeof(content_json->'scores') IS DISTINCT FROM 'object'
     OR NOT (content_json->'scores' ?& ARRAY['clarity', 'solution', 'market', 'presentation'])
     OR (SELECT count(*) FROM jsonb_object_keys(content_json->'scores')) <> 4 THEN
    RAISE EXCEPTION 'Feedback content failed validation';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_each(content_json->'scores') AS score(key, value)
    WHERE key NOT IN ('clarity', 'solution', 'market', 'presentation')
       OR jsonb_typeof(value) IS DISTINCT FROM 'number'
       OR (value #>> '{}')::numeric NOT BETWEEN 1 AND 10
  ) THEN
    RAISE EXCEPTION 'Feedback content failed validation';
  END IF;

  SELECT pitch.user_id INTO pitch_owner_id
  FROM public.pitches AS pitch
  WHERE pitch.id = target_pitch_id
    AND pitch.status = 'published'
    AND pitch.deleted_at IS NULL;

  IF pitch_owner_id IS NULL THEN
    RAISE EXCEPTION 'Pitch not found';
  END IF;
  IF pitch_owner_id = caller_id THEN
    RAISE EXCEPTION 'A reviewer cannot leave feedback on their own pitch';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.pitch_event_submissions AS submission
    WHERE submission.event_id = target_event_id
      AND submission.pitch_id = target_pitch_id
      AND submission.status IN ('submitted', 'locked')
  ) THEN
    RAISE EXCEPTION 'This pitch was not submitted to that event';
  END IF;
  IF NOT (
    EXISTS (
      SELECT 1
      FROM public.pitch_events AS event
      WHERE event.id = target_event_id
        AND event.organizer_id = caller_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.pitch_event_participants AS participant
      WHERE participant.event_id = target_event_id
        AND participant.user_id = caller_id
        AND participant.status = 'active'
        AND participant.role IN ('organizer', 'admin', 'coach', 'mentor', 'judge')
    )
    OR EXISTS (
      SELECT 1
      FROM public.review_assignments AS assignment
      WHERE assignment.event_id = target_event_id
        AND assignment.pitch_id = target_pitch_id
        AND assignment.reviewer_user_id = caller_id
        AND assignment.status IN ('pending', 'started', 'submitted')
        AND (
          EXISTS (
            SELECT 1
            FROM public.pitch_event_participants AS assigned_participant
            WHERE assigned_participant.event_id = target_event_id
              AND assigned_participant.user_id = caller_id
              AND assigned_participant.status = 'active'
          )
          OR public.is_trusted_reviewer_for_event(target_event_id)
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.pitch_events AS peer_event
      JOIN public.pitch_event_participants AS peer_participant
        ON peer_participant.event_id = peer_event.id
       AND peer_participant.user_id = caller_id
       AND peer_participant.status = 'active'
      WHERE peer_event.id = target_event_id
        AND peer_event.peer_feedback_enabled
        AND peer_event.status <> 'archived'
    )
  ) THEN
    RAISE EXCEPTION 'Active event-team access is required';
  END IF;

  -- Older event rows may predate organizer participant replay protection. Keep
  -- the owner path authorized by ensuring the participant row required by the
  -- assignment validation trigger exists before direct dashboard feedback.
  IF EXISTS (
    SELECT 1
    FROM public.pitch_events AS owned_event
    WHERE owned_event.id = target_event_id
      AND owned_event.organizer_id = caller_id
  ) THEN
    INSERT INTO public.pitch_event_participants (event_id, user_id, role, status)
    VALUES (target_event_id, caller_id, 'organizer', 'active')
    ON CONFLICT (event_id, user_id) DO UPDATE
      SET role = 'organizer', status = 'active';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      caller_id::text || ':' || target_pitch_id::text || ':' || target_event_id::text,
      0
    )
  );

  SELECT * INTO saved_feedback
  FROM public.feedback AS existing
  WHERE existing.user_id = caller_id
    AND existing.pitch_id = target_pitch_id
    AND existing.submission_key = request_key;

  IF saved_feedback.id IS NOT NULL THEN
    IF saved_feedback.type IS DISTINCT FROM feedback_type
       OR saved_feedback.content::jsonb IS DISTINCT FROM content_json THEN
      RAISE EXCEPTION 'Submission key was already used with different feedback';
    END IF;
    IF saved_feedback.review_assignment_id IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM public.review_assignments AS replay_assignment
         WHERE replay_assignment.id = saved_feedback.review_assignment_id
           AND replay_assignment.event_id = target_event_id
       ) THEN
      RAISE EXCEPTION 'Submission key was already used for another event';
    END IF;

    RETURN QUERY SELECT
      saved_feedback.id,
      saved_feedback.type,
      saved_feedback.reviewer_role,
      saved_feedback.created_at,
      saved_feedback.review_assignment_id IS NOT NULL,
      true;
    RETURN;
  END IF;

  SELECT assignment.* INTO matched_assignment
  FROM public.review_assignments AS assignment
  WHERE assignment.reviewer_user_id = caller_id
    AND assignment.pitch_id = target_pitch_id
    AND assignment.event_id = target_event_id
    AND assignment.status IN ('pending', 'started')
  ORDER BY
    CASE assignment.status WHEN 'started' THEN 0 ELSE 1 END,
    assignment.due_at ASC NULLS LAST,
    assignment.created_at ASC,
    assignment.id ASC
  LIMIT 1
  FOR UPDATE;

  IF matched_assignment.id IS NULL AND EXISTS (
    SELECT 1
    FROM public.review_assignments AS completed_assignment
    WHERE completed_assignment.reviewer_user_id = caller_id
      AND completed_assignment.pitch_id = target_pitch_id
      AND completed_assignment.event_id = target_event_id
      AND completed_assignment.status = 'submitted'
  ) THEN
    RAISE EXCEPTION 'You already reviewed this pitch for this event';
  END IF;

  -- Dashboard team members can review directly without a pre-built queue. Give
  -- that review an exact event assignment so completion and coverage remain
  -- event-scoped even when the same pitch appears in multiple events.
  IF matched_assignment.id IS NULL THEN
    INSERT INTO public.review_assignments (
      pitch_id,
      reviewer_user_id,
      event_id,
      status,
      assignment_reason,
      assigned_by
    ) VALUES (
      target_pitch_id,
      caller_id,
      target_event_id,
      'pending',
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM public.pitch_events AS team_event
          WHERE team_event.id = target_event_id
            AND team_event.organizer_id = caller_id
        ) OR EXISTS (
          SELECT 1
          FROM public.pitch_event_participants AS team_participant
          WHERE team_participant.event_id = target_event_id
            AND team_participant.user_id = caller_id
            AND team_participant.status = 'active'
            AND team_participant.role IN ('organizer', 'admin', 'coach', 'mentor', 'judge')
        ) THEN 'event_team_feedback'
        ELSE 'cohort_peer_feedback'
      END,
      caller_id
    )
    ON CONFLICT (event_id, pitch_id, reviewer_user_id)
      WHERE event_id IS NOT NULL
      DO NOTHING;

    SELECT assignment.* INTO matched_assignment
    FROM public.review_assignments AS assignment
    WHERE assignment.reviewer_user_id = caller_id
      AND assignment.pitch_id = target_pitch_id
      AND assignment.event_id = target_event_id
      AND assignment.status IN ('pending', 'started')
    ORDER BY
      CASE assignment.status WHEN 'started' THEN 0 ELSE 1 END,
      assignment.due_at ASC NULLS LAST,
      assignment.created_at ASC,
      assignment.id ASC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF matched_assignment.id IS NULL THEN
    RAISE EXCEPTION 'This event review is no longer available';
  END IF;

  INSERT INTO public.feedback (
    pitch_id,
    user_id,
    type,
    content,
    is_public,
    review_assignment_id,
    submission_key
  ) VALUES (
    target_pitch_id,
    caller_id,
    feedback_type,
    content_json::text,
    true,
    matched_assignment.id,
    request_key
  )
  RETURNING * INTO saved_feedback;

  RETURN QUERY SELECT
    saved_feedback.id,
    saved_feedback.type,
    saved_feedback.reviewer_role,
    saved_feedback.created_at,
    true,
    false;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_event_feedback_scope(
  target_event_slug text,
  target_pitch_id uuid
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
  SELECT event.id
  FROM public.pitch_events AS event
  JOIN public.pitch_event_submissions AS submission
    ON submission.event_id = event.id
   AND submission.pitch_id = target_pitch_id
   AND submission.status IN ('submitted', 'locked')
  WHERE event.slug = target_event_slug
    AND (
      event.organizer_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.pitch_event_participants AS participant
        WHERE participant.event_id = event.id
          AND participant.user_id = auth.uid()
          AND participant.status = 'active'
          AND participant.role IN ('organizer', 'admin', 'coach', 'mentor', 'judge')
      )
      OR EXISTS (
        SELECT 1
        FROM public.review_assignments AS assignment
        WHERE assignment.event_id = event.id
          AND assignment.pitch_id = target_pitch_id
          AND assignment.reviewer_user_id = auth.uid()
          AND assignment.status IN ('pending', 'started', 'submitted')
          AND (
            EXISTS (
              SELECT 1
              FROM public.pitch_event_participants AS assigned_participant
              WHERE assigned_participant.event_id = event.id
                AND assigned_participant.user_id = auth.uid()
                AND assigned_participant.status = 'active'
            )
            OR public.is_trusted_reviewer_for_event(event.id)
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.pitch_event_participants AS peer_participant
        WHERE peer_participant.event_id = event.id
          AND peer_participant.user_id = auth.uid()
          AND peer_participant.status = 'active'
          AND event.peer_feedback_enabled
          AND event.status <> 'archived'
      )
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.submit_event_pitch_feedback(uuid, text, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_event_pitch_feedback(uuid, text, text, uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.resolve_event_feedback_scope(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_event_feedback_scope(text, uuid) TO authenticated;

COMMENT ON FUNCTION public.resolve_event_feedback_scope(text, uuid) IS
  'Resolves an exact event review for active team members, the assigned reviewer, or any active participant when the event allows peer feedback.';
