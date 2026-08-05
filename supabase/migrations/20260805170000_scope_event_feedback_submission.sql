-- Keep event-team feedback attached to the event the reviewer opened. The
-- existing four-argument RPC remains available for the global review queue.
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
      'event_team_feedback',
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

REVOKE ALL ON FUNCTION public.submit_event_pitch_feedback(uuid, text, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_event_pitch_feedback(uuid, text, text, uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.submit_event_pitch_feedback(uuid, text, text, uuid, uuid) IS
  'Submits feedback for one exact event and completes only that event assignment.';

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
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_event_feedback_scope(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_event_feedback_scope(text, uuid) TO authenticated;

COMMENT ON FUNCTION public.resolve_event_feedback_scope(text, uuid) IS
  'Resolves an exact event review for active team members or the assigned reviewer without exposing event data.';

CREATE OR REPLACE FUNCTION public.can_view_event_review_workspace(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1
      FROM public.pitch_events AS event
      WHERE event.id = target_event_id
        AND event.organizer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.pitch_event_participants AS participant
      WHERE participant.event_id = target_event_id
        AND participant.user_id = auth.uid()
        AND participant.status = 'active'
        AND participant.role IN ('organizer', 'admin', 'coach', 'mentor', 'judge')
    )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_event_review_workspace(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.get_event_review_assignments(target_event_id uuid)
RETURNS TABLE(
  id uuid,
  pitch_id uuid,
  status text,
  completed_feedback_id uuid,
  completed_at timestamp with time zone
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
    assignment.completed_at
  FROM public.review_assignments AS assignment
  WHERE assignment.event_id = target_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_event_review_assignments(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_review_assignments(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_event_review_quality_summary(target_event_id uuid)
RETURNS TABLE(useful_reviews bigint, pitches_with_useful_feedback bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
BEGIN
  IF NOT public.can_view_event_review_workspace(target_event_id) THEN
    RAISE EXCEPTION 'Not authorized to view event review quality';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE quality.rating = 'useful'),
    COUNT(DISTINCT assignment.pitch_id) FILTER (WHERE quality.rating = 'useful')
  FROM public.review_assignments AS assignment
  LEFT JOIN public.feedback_quality_votes AS quality
    ON quality.feedback_id = assignment.completed_feedback_id
  WHERE assignment.event_id = target_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_event_review_quality_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_review_quality_summary(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_event_review_assignments(uuid) IS
  'Returns event-wide assignment coverage to active event team members without widening row-level assignment visibility.';

CREATE OR REPLACE FUNCTION public.get_review_assignment_event_identities(target_assignment_ids uuid[])
RETURNS TABLE(assignment_id uuid, slug text, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR target_assignment_ids IS NULL
     OR cardinality(target_assignment_ids) NOT BETWEEN 1 AND 20 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT assignment.id,
    event.slug,
    event.name
  FROM public.review_assignments AS assignment
  JOIN public.pitch_events AS event ON event.id = assignment.event_id
  WHERE assignment.id = ANY(target_assignment_ids)
    AND assignment.reviewer_user_id = auth.uid()
    AND assignment.status IN ('pending', 'started')
    AND (
      EXISTS (
        SELECT 1
        FROM public.pitch_event_participants AS participant
        WHERE participant.event_id = event.id
          AND participant.user_id = auth.uid()
          AND participant.status = 'active'
      )
      OR public.is_trusted_reviewer_for_event(event.id)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_review_assignment_event_identities(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_review_assignment_event_identities(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.get_review_assignment_event_identities(uuid[]) IS
  'Returns only the event label needed to complete the caller active assignments, including private trusted-reviewer events.';

-- Keep public-feed feedback on the global queue. Event assignments are only
-- completed through submit_event_pitch_feedback with an explicit event scope.
CREATE OR REPLACE FUNCTION public.submit_pitch_feedback(
  target_pitch_id uuid,
  feedback_type text,
  feedback_content text,
  request_key uuid
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
  IF request_key IS NULL THEN
    RAISE EXCEPTION 'A submission key is required';
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

  PERFORM pg_advisory_xact_lock(
    hashtextextended(caller_id::text || ':' || target_pitch_id::text || ':global', 0)
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
    IF saved_feedback.review_assignment_id IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM public.review_assignments AS replay_assignment
         WHERE replay_assignment.id = saved_feedback.review_assignment_id
           AND replay_assignment.event_id IS NOT NULL
       ) THEN
      RAISE EXCEPTION 'Submission key was already used for an event review';
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
    AND assignment.event_id IS NULL
    AND assignment.status IN ('pending', 'started')
  ORDER BY
    CASE assignment.status WHEN 'started' THEN 0 ELSE 1 END,
    assignment.due_at ASC NULLS LAST,
    assignment.created_at ASC,
    assignment.id ASC
  LIMIT 1
  FOR UPDATE;

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
    saved_feedback.review_assignment_id IS NOT NULL,
    false;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_pitch_feedback(uuid, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_pitch_feedback(uuid, text, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.submit_pitch_feedback(uuid, text, text, uuid) IS
  'Submits ordinary feedback and completes only a global review assignment.';

-- Keep one ordinary/public review per pitch, while allowing an event-team
-- reviewer to give one distinct review in each event where the pitch appears.
CREATE OR REPLACE FUNCTION public.prevent_duplicate_pitch_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  new_event_id uuid;
BEGIN
  SELECT assignment.event_id INTO new_event_id
  FROM public.review_assignments AS assignment
  WHERE assignment.id = NEW.review_assignment_id;

  IF new_event_id IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.feedback AS existing
      LEFT JOIN public.review_assignments AS existing_assignment
        ON existing_assignment.id = existing.review_assignment_id
      WHERE existing.pitch_id = NEW.pitch_id
        AND existing.user_id = NEW.user_id
        AND existing_assignment.event_id IS NULL
    ) THEN
      RAISE EXCEPTION 'You already reviewed this pitch';
    END IF;
  ELSIF EXISTS (
    SELECT 1
    FROM public.feedback AS existing
    JOIN public.review_assignments AS existing_assignment
      ON existing_assignment.id = existing.review_assignment_id
    WHERE existing.pitch_id = NEW.pitch_id
      AND existing.user_id = NEW.user_id
      AND existing_assignment.event_id = new_event_id
  ) THEN
    RAISE EXCEPTION 'You already reviewed this pitch for this event';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_duplicate_pitch_feedback() FROM PUBLIC;

COMMENT ON FUNCTION public.prevent_duplicate_pitch_feedback() IS
  'Allows one ordinary review per reviewer/pitch plus one review per event assignment.';

-- A reviewer/pitch pair used in one event must not suppress the queue for a
-- different event. Keep queue capacity and duplicate checks event-local.
CREATE OR REPLACE FUNCTION public.generate_review_assignments(
  target_event_id uuid,
  target_per_reviewer integer DEFAULT 3,
  target_due_at timestamp with time zone DEFAULT (now() + interval '24 hours')
)
RETURNS SETOF public.review_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_review_event(target_event_id) THEN
    RAISE EXCEPTION 'Not authorized to generate review assignments for this event';
  END IF;

  IF target_per_reviewer NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'target_per_reviewer must be between 1 and 20';
  END IF;

  RETURN QUERY
  WITH reviewers AS (
    SELECT participant.user_id,
      CASE participant.role
        WHEN 'founder' THEN 'peer_founder'
        WHEN 'admin' THEN 'organizer'
        ELSE participant.role
      END AS role_snapshot,
      GREATEST(
        target_per_reviewer - COUNT(assignment.id) FILTER (
          WHERE assignment.status IN ('pending', 'started')
        )::integer,
        0
      ) AS slots
    FROM public.pitch_event_participants AS participant
    LEFT JOIN public.review_assignments AS assignment
      ON assignment.event_id = participant.event_id
      AND assignment.reviewer_user_id = participant.user_id
    WHERE participant.event_id = target_event_id
      AND participant.status = 'active'
    GROUP BY participant.user_id, participant.role
  ), candidates AS (
    SELECT reviewer.user_id AS reviewer_user_id,
      reviewer.role_snapshot,
      choice.pitch_id
    FROM reviewers AS reviewer
    CROSS JOIN LATERAL (
      SELECT submission.pitch_id
      FROM public.pitch_event_submissions AS submission
      JOIN public.pitches AS pitch ON pitch.id = submission.pitch_id
      WHERE submission.event_id = target_event_id
        AND submission.status IN ('submitted', 'locked')
        AND pitch.deleted_at IS NULL
        AND pitch.user_id <> reviewer.user_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.review_assignments AS existing
          WHERE existing.event_id = target_event_id
            AND existing.pitch_id = submission.pitch_id
            AND existing.reviewer_user_id = reviewer.user_id
        )
      ORDER BY (
        SELECT COUNT(*)
        FROM public.review_assignments AS coverage
        WHERE coverage.event_id = target_event_id
          AND coverage.pitch_id = submission.pitch_id
          AND coverage.status IN ('pending', 'started', 'submitted')
      ), md5(submission.pitch_id::text || reviewer.user_id::text), submission.submitted_at, submission.pitch_id
      LIMIT reviewer.slots
    ) AS choice
  )
  INSERT INTO public.review_assignments (
    pitch_id,
    reviewer_user_id,
    event_id,
    reviewer_role,
    assignment_reason,
    due_at,
    assigned_by
  )
  SELECT pitch_id,
    reviewer_user_id,
    target_event_id,
    role_snapshot,
    'event_coverage',
    target_due_at,
    auth.uid()
  FROM candidates
  ON CONFLICT DO NOTHING
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_review_assignments(uuid, integer, timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_review_assignments(uuid, integer, timestamp with time zone)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.generate_review_assignments(uuid, integer, timestamp with time zone) IS
  'Generates review coverage without allowing assignments from other events to suppress this event queue.';
