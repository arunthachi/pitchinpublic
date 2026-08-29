-- Expand phase for the production data-visibility incident.
--
-- This migration adds purpose-built projections before direct feedback identity
-- access is contracted in a later migration. All privileged functions derive
-- the caller from auth.uid(), use a fixed search_path, and expose only the
-- minimum fields required by their caller.

-- ---------------------------------------------------------------------------
-- Canonical public-pitch counts
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_pitches_public_leaderboard_user
  ON public.pitches (user_id)
  WHERE status = 'published'
    AND visibility = 'public'
    AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.update_pitch_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  old_is_public integer := 0;
  new_is_public integer := 0;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE')
     AND OLD.status = 'published'
     AND OLD.visibility = 'public'
     AND OLD.deleted_at IS NULL THEN
    old_is_public := 1;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE')
     AND NEW.status = 'published'
     AND NEW.visibility = 'public'
     AND NEW.deleted_at IS NULL THEN
    new_is_public := 1;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.user_id = NEW.user_id THEN
    UPDATE public.profiles
    SET pitches_count = greatest(0, coalesce(pitches_count, 0) + new_is_public - old_is_public)
    WHERE id = NEW.user_id;
  ELSE
    IF TG_OP IN ('UPDATE', 'DELETE') AND old_is_public = 1 THEN
      UPDATE public.profiles
      SET pitches_count = greatest(0, coalesce(pitches_count, 0) - 1)
      WHERE id = OLD.user_id;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') AND new_is_public = 1 THEN
      UPDATE public.profiles
      SET pitches_count = coalesce(pitches_count, 0) + 1
      WHERE id = NEW.user_id;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.company_id IS NOT DISTINCT FROM NEW.company_id THEN
    IF NEW.company_id IS NOT NULL THEN
      UPDATE public.companies
      SET pitches_count = greatest(0, coalesce(pitches_count, 0) + new_is_public - old_is_public)
      WHERE id = NEW.company_id;
    END IF;
  ELSE
    IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.company_id IS NOT NULL AND old_is_public = 1 THEN
      UPDATE public.companies
      SET pitches_count = greatest(0, coalesce(pitches_count, 0) - 1)
      WHERE id = OLD.company_id;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.company_id IS NOT NULL AND new_is_public = 1 THEN
      UPDATE public.companies
      SET pitches_count = coalesce(pitches_count, 0) + 1
      WHERE id = NEW.company_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.update_pitch_counts() FROM PUBLIC;

DROP TRIGGER IF EXISTS pitch_count_trigger ON public.pitches;
CREATE TRIGGER pitch_count_trigger
  AFTER INSERT OR DELETE OR UPDATE OF user_id, company_id, status, visibility, deleted_at
  ON public.pitches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pitch_counts();

UPDATE public.profiles AS profile
SET pitches_count = (
  SELECT count(*)::integer
  FROM public.pitches AS pitch
  WHERE pitch.user_id = profile.id
    AND pitch.status = 'published'
    AND pitch.visibility = 'public'
    AND pitch.deleted_at IS NULL
);

UPDATE public.companies AS company
SET pitches_count = (
  SELECT count(*)::integer
  FROM public.pitches AS pitch
  WHERE pitch.company_id = company.id
    AND pitch.status = 'published'
    AND pitch.visibility = 'public'
    AND pitch.deleted_at IS NULL
);

-- Older application versions call this after INSERT even though the trigger is
-- already the single counter writer. Preserve the signature as an idempotent
-- compatibility shim while callers migrate away from it.
CREATE OR REPLACE FUNCTION public.increment_user_pitches_count(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id);
$$;

REVOKE ALL ON FUNCTION public.increment_user_pitches_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_user_pitches_count(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_public_pitch_leaderboard(
  target_limit integer DEFAULT 50,
  target_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  IF target_limit NOT BETWEEN 1 AND 100 OR target_offset NOT BETWEEN 0 AND 10000 THEN
    RAISE EXCEPTION 'Invalid leaderboard pagination';
  END IF;

  WITH pitch_counts AS (
    SELECT pitch.user_id, count(*)::bigint AS pitches_count
    FROM public.pitches AS pitch
    WHERE pitch.status = 'published'
      AND pitch.visibility = 'public'
      AND pitch.deleted_at IS NULL
    GROUP BY pitch.user_id
  ), ranked AS (
    SELECT profile.id AS user_id,
      profile.full_name,
      profile.avatar_url,
      pitch_counts.pitches_count,
      row_number() OVER (
        ORDER BY pitch_counts.pitches_count DESC, profile.id ASC
      )::bigint AS rank
    FROM pitch_counts
    JOIN public.profiles AS profile ON profile.id = pitch_counts.user_id
  ), page AS (
    SELECT *
    FROM ranked
    ORDER BY rank
    LIMIT target_limit OFFSET target_offset
  )
  SELECT jsonb_build_object(
    'entries', coalesce(
      (SELECT jsonb_agg(to_jsonb(page) ORDER BY page.rank) FROM page),
      '[]'::jsonb
    ),
    'total', (SELECT count(*) FROM ranked)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_pitch_leaderboard(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_pitch_leaderboard(integer, integer)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_public_pitch_leaderboard(integer, integer) IS
  'Returns deterministic ranks derived from active, published, public pitches.';

-- ---------------------------------------------------------------------------
-- Review assignment lifecycle and queue indexes
-- ---------------------------------------------------------------------------

ALTER TABLE public.review_assignments
  ADD COLUMN IF NOT EXISTS invalidated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS invalidation_reason text;

ALTER TABLE public.review_assignments
  DROP CONSTRAINT IF EXISTS review_assignments_status_check,
  DROP CONSTRAINT IF EXISTS review_assignments_completion_check;

ALTER TABLE public.review_assignments
  ADD CONSTRAINT review_assignments_status_check CHECK (
    status IN ('pending', 'started', 'submitted', 'invalidated')
  ) NOT VALID,
  ADD CONSTRAINT review_assignments_completion_check CHECK (
    (status = 'submitted'
      AND completed_feedback_id IS NOT NULL
      AND completed_at IS NOT NULL
      AND invalidated_at IS NULL
      AND invalidation_reason IS NULL)
    OR (status = 'invalidated'
      AND completed_feedback_id IS NULL
      AND completed_at IS NULL
      AND invalidated_at IS NOT NULL
      AND char_length(trim(invalidation_reason)) BETWEEN 1 AND 240)
    OR (status IN ('pending', 'started')
      AND completed_feedback_id IS NULL
      AND completed_at IS NULL
      AND invalidated_at IS NULL
      AND invalidation_reason IS NULL)
  ) NOT VALID;

ALTER TABLE public.review_assignments
  VALIDATE CONSTRAINT review_assignments_status_check;
ALTER TABLE public.review_assignments
  VALIDATE CONSTRAINT review_assignments_completion_check;

DROP INDEX IF EXISTS public.idx_review_assignments_unique_event_review;
DROP INDEX IF EXISTS public.idx_review_assignments_unique_global_review;

CREATE UNIQUE INDEX idx_review_assignments_unique_event_review
  ON public.review_assignments(event_id, pitch_id, reviewer_user_id)
  WHERE event_id IS NOT NULL AND status <> 'invalidated';

CREATE UNIQUE INDEX idx_review_assignments_unique_global_review
  ON public.review_assignments(pitch_id, reviewer_user_id)
  WHERE event_id IS NULL AND status <> 'invalidated';

CREATE INDEX IF NOT EXISTS idx_review_assignments_active_reviewer_queue
  ON public.review_assignments(reviewer_user_id, reviewer_role, due_at, created_at, id)
  WHERE status IN ('pending', 'started');

CREATE INDEX IF NOT EXISTS idx_feedback_author_history
  ON public.feedback(user_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_pitch_history
  ON public.feedback(pitch_id, created_at DESC, id DESC);

-- Keep the existing validation contract, but make invalidation a one-way audit
-- transition that remains possible after a pitch or event permission disappears.
CREATE OR REPLACE FUNCTION public.validate_review_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  pitch_owner_id uuid;
  participant_role text;
  feedback_pitch_id uuid;
  feedback_reviewer_id uuid;
  caller_can_manage boolean;
  reviewer_is_trusted boolean;
  reviewer_has_event_grant boolean;
  global_identity_changed boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'invalidated' THEN
    IF OLD.status NOT IN ('pending', 'started') THEN
      RAISE EXCEPTION 'Only an active review assignment can be invalidated';
    END IF;
    IF NEW.pitch_id IS DISTINCT FROM OLD.pitch_id
       OR NEW.reviewer_user_id IS DISTINCT FROM OLD.reviewer_user_id
       OR NEW.event_id IS DISTINCT FROM OLD.event_id
       OR NEW.reviewer_role IS DISTINCT FROM OLD.reviewer_role
       OR NEW.assignment_reason IS DISTINCT FROM OLD.assignment_reason
       OR NEW.due_at IS DISTINCT FROM OLD.due_at
       OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Invalidation cannot change assignment identity';
    END IF;
    NEW.completed_feedback_id := NULL;
    NEW.completed_at := NULL;
    NEW.invalidated_at := coalesce(NEW.invalidated_at, now());
    IF NEW.invalidation_reason IS NULL
       OR char_length(trim(NEW.invalidation_reason)) NOT BETWEEN 1 AND 240 THEN
      RAISE EXCEPTION 'An invalidation reason is required';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'invalidated' THEN
    RAISE EXCEPTION 'An invalidated review assignment is terminal';
  END IF;

  SELECT pitch.user_id
    INTO pitch_owner_id
  FROM public.pitches AS pitch
  WHERE pitch.id = NEW.pitch_id
    AND pitch.deleted_at IS NULL;

  IF pitch_owner_id IS NULL THEN
    RAISE EXCEPTION 'Review assignment pitch must exist and be active';
  END IF;
  IF pitch_owner_id = NEW.reviewer_user_id THEN
    RAISE EXCEPTION 'A reviewer cannot be assigned their own pitch';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.trusted_reviewer_memberships AS membership
    WHERE membership.user_id = NEW.reviewer_user_id
      AND membership.status = 'active'
  ) INTO reviewer_is_trusted;

  IF NEW.event_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.pitch_event_submissions AS submission
      WHERE submission.event_id = NEW.event_id
        AND submission.pitch_id = NEW.pitch_id
        AND submission.status IN ('submitted', 'locked')
    ) THEN
      RAISE EXCEPTION 'Assigned pitch is not submitted to the selected event';
    END IF;

    SELECT participant.role
      INTO participant_role
    FROM public.pitch_event_participants AS participant
    WHERE participant.event_id = NEW.event_id
      AND participant.user_id = NEW.reviewer_user_id
      AND participant.status = 'active';

    IF participant_role IS NOT NULL THEN
      NEW.reviewer_role := CASE participant_role
        WHEN 'founder' THEN 'peer_founder'
        WHEN 'admin' THEN 'organizer'
        ELSE participant_role
      END;
    ELSE
      SELECT reviewer_is_trusted AND EXISTS (
        SELECT 1
        FROM public.trusted_reviewer_event_access AS event_access
        JOIN public.trusted_reviewer_memberships AS granted_membership
          ON granted_membership.id = event_access.membership_id
        WHERE event_access.event_id = NEW.event_id
          AND granted_membership.user_id = NEW.reviewer_user_id
      ) INTO reviewer_has_event_grant;

      IF NOT reviewer_has_event_grant THEN
        RAISE EXCEPTION
          'Assigned reviewer is not an active event participant or trusted reviewer';
      END IF;
      NEW.reviewer_role := 'trusted_reviewer';
    END IF;
  ELSE
    IF TG_OP = 'INSERT' THEN
      global_identity_changed := true;
    ELSE
      global_identity_changed := OLD.event_id IS NOT NULL
        OR NEW.reviewer_user_id IS DISTINCT FROM OLD.reviewer_user_id;
    END IF;

    IF global_identity_changed THEN
      IF reviewer_is_trusted THEN
        NEW.reviewer_role := 'trusted_reviewer';
      ELSIF EXISTS (
        SELECT 1
        FROM public.pilot_members AS pilot
        WHERE pilot.user_id = NEW.reviewer_user_id
      ) THEN
        NEW.reviewer_role := CASE
          WHEN EXISTS (
            SELECT 1
            FROM public.pitches AS authored_pitch
            WHERE authored_pitch.user_id = NEW.reviewer_user_id
          ) THEN 'peer_founder'
          ELSE 'public_reviewer'
        END;
      ELSE
        RAISE EXCEPTION
          'Global review assignments require active pilot or trusted reviewer access';
      END IF;
    END IF;
  END IF;

  IF NEW.completed_feedback_id IS NOT NULL THEN
    SELECT submitted_feedback.pitch_id, submitted_feedback.user_id
      INTO feedback_pitch_id, feedback_reviewer_id
    FROM public.feedback AS submitted_feedback
    WHERE submitted_feedback.id = NEW.completed_feedback_id;

    IF feedback_pitch_id IS DISTINCT FROM NEW.pitch_id
       OR feedback_reviewer_id IS DISTINCT FROM NEW.reviewer_user_id THEN
      RAISE EXCEPTION 'Completed feedback must match the assigned pitch and reviewer';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    caller_can_manage := auth.uid() IS NULL
      OR public.is_platform_admin()
      OR (OLD.event_id IS NOT NULL AND public.can_manage_review_event(OLD.event_id));

    IF NOT caller_can_manage AND auth.uid() = OLD.reviewer_user_id THEN
      IF NEW.pitch_id IS DISTINCT FROM OLD.pitch_id
         OR NEW.reviewer_user_id IS DISTINCT FROM OLD.reviewer_user_id
         OR NEW.event_id IS DISTINCT FROM OLD.event_id
         OR NEW.reviewer_role IS DISTINCT FROM OLD.reviewer_role
         OR NEW.assignment_reason IS DISTINCT FROM OLD.assignment_reason
         OR NEW.due_at IS DISTINCT FROM OLD.due_at
         OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
         OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Reviewers cannot change assignment ownership or configuration';
      END IF;

      IF NOT (
        (OLD.status = 'pending' AND NEW.status IN ('pending', 'started', 'submitted'))
        OR (OLD.status = 'started' AND NEW.status IN ('started', 'submitted'))
        OR OLD.status = NEW.status
      ) THEN
        RAISE EXCEPTION 'Invalid reviewer assignment status transition';
      END IF;
    END IF;
  END IF;

  IF NEW.status = 'started' AND NEW.started_at IS NULL THEN
    NEW.started_at := now();
  END IF;
  IF NEW.status = 'submitted' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;
  NEW.invalidated_at := NULL;
  NEW.invalidation_reason := NULL;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_review_assignment() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.is_review_assignment_eligible(target_assignment_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.review_assignments AS assignment
    JOIN public.pitches AS pitch ON pitch.id = assignment.pitch_id
    WHERE assignment.id = target_assignment_id
      AND assignment.reviewer_user_id = auth.uid()
      AND assignment.status IN ('pending', 'started')
      AND pitch.user_id <> auth.uid()
      AND pitch.status = 'published'
      AND pitch.deleted_at IS NULL
      AND public.is_pilot_user()
      AND (
        (
          assignment.event_id IS NULL
          AND (
            pitch.visibility = 'public'
            OR (
              assignment.reviewer_role = 'trusted_reviewer'
              AND public.is_trusted_reviewer()
              AND public.can_trusted_reviewer_view_pitch(pitch.id)
            )
          )
        )
        OR (
          assignment.event_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.pitch_event_submissions AS submission
            WHERE submission.event_id = assignment.event_id
              AND submission.pitch_id = assignment.pitch_id
              AND submission.status IN ('submitted', 'locked')
          )
          AND (
            EXISTS (
              SELECT 1
              FROM public.pitch_event_participants AS participant
              WHERE participant.event_id = assignment.event_id
                AND participant.user_id = auth.uid()
                AND participant.status = 'active'
            )
            OR (
              assignment.reviewer_role = 'trusted_reviewer'
              AND public.is_trusted_reviewer_for_event(assignment.event_id)
            )
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_review_assignment_eligible(uuid) FROM PUBLIC;

-- The event submission RPC has an explicit conflict target. Retarget it to the
-- active-row partial index without changing its established validation logic.
DO $migration$
DECLARE
  function_definition text;
  patched_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.submit_event_pitch_feedback(uuid,text,text,uuid,uuid)'::regprocedure
  ) INTO function_definition;

  patched_definition := replace(
    function_definition,
    E'WHERE event_id IS NOT NULL\n      DO NOTHING',
    E'WHERE event_id IS NOT NULL AND status <> ''invalidated''\n      DO NOTHING'
  );

  IF patched_definition = function_definition THEN
    RAISE EXCEPTION 'Could not retarget submit_event_pitch_feedback conflict predicate';
  END IF;

  EXECUTE patched_definition;
END;
$migration$;

REVOKE ALL ON FUNCTION public.submit_event_pitch_feedback(uuid, text, text, uuid, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_event_pitch_feedback(uuid, text, text, uuid, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_structured_event_pitch_feedback(
  target_pitch_id uuid,
  feedback_type text,
  feedback_content text,
  target_event_id uuid,
  submission_key uuid,
  criterion text,
  observed text,
  recommended_next_step text
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
SET search_path = pg_catalog
AS $$
DECLARE
  result_record record;
  guideline_id uuid;
  disclosure text;
BEGIN
  -- Match the pitch-first lock order before the delegated submission RPC takes
  -- an assignment lock.
  PERFORM pitch.id
  FROM public.pitches AS pitch
  WHERE pitch.id = target_pitch_id
    AND pitch.status = 'published'
    AND pitch.deleted_at IS NULL
  FOR SHARE;

  SELECT coalesce(
      pitch.event_guideline_version_id,
      submission.guideline_version_id,
      event.current_guideline_version_id
    ),
    event.feedback_disclosure_mode
  INTO guideline_id, disclosure
  FROM public.pitch_events AS event
  JOIN public.pitches AS pitch ON pitch.id = target_pitch_id
  LEFT JOIN public.pitch_event_submissions AS submission
    ON submission.event_id = event.id
   AND submission.pitch_id = pitch.id
  WHERE event.id = target_event_id
    AND (pitch.event_id = event.id OR submission.id IS NOT NULL);

  IF guideline_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.event_pitch_guideline_versions AS guideline,
      jsonb_array_elements(guideline.criteria) AS item
    WHERE guideline.id = guideline_id
      AND item->>'key' = criterion
  ) THEN
    RAISE EXCEPTION 'A current guideline criterion is required';
  END IF;
  IF char_length(btrim(coalesce(observed, ''))) < 2
     OR char_length(btrim(coalesce(recommended_next_step, ''))) < 2 THEN
    RAISE EXCEPTION 'Observation and next step are required';
  END IF;

  SELECT * INTO result_record
  FROM public.submit_event_pitch_feedback(
    target_pitch_id,
    feedback_type,
    feedback_content,
    submission_key,
    target_event_id
  );

  IF NOT result_record.idempotent_replay THEN
    UPDATE public.feedback
    SET event_guideline_version_id = guideline_id,
        criterion_key = criterion,
        observation = btrim(observed),
        next_step = btrim(recommended_next_step),
        disclosure_mode = disclosure
    WHERE id = result_record.feedback_id
      AND user_id = auth.uid();
  END IF;

  RETURN QUERY SELECT
    result_record.feedback_id,
    result_record.submitted_type,
    result_record.reviewer_role,
    result_record.created_at,
    result_record.assignment_completed,
    result_record.idempotent_replay;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_structured_event_pitch_feedback(
  uuid, text, text, uuid, uuid, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_structured_event_pitch_feedback(
  uuid, text, text, uuid, uuid, text, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_review_queue_snapshot(
  target_limit integer DEFAULT 3,
  target_mode text DEFAULT 'founder'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  caller_id uuid := auth.uid();
  role_filter text[];
  assignments_json jsonb;
  credits_json jsonb;
  pending_count integer;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF target_limit NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'target_limit must be between 1 and 10';
  END IF;
  IF target_mode NOT IN ('founder', 'reviewer') THEN
    RAISE EXCEPTION 'target_mode must be founder or reviewer';
  END IF;
  IF NOT public.is_pilot_user() THEN
    RAISE EXCEPTION 'Invite-only access is required';
  END IF;
  IF target_mode = 'reviewer' AND NOT public.is_trusted_reviewer() THEN
    RAISE EXCEPTION 'Trusted reviewer access is required';
  END IF;

  role_filter := CASE target_mode
    WHEN 'reviewer' THEN ARRAY['trusted_reviewer']::text[]
    ELSE ARRAY[
      'peer_founder', 'public_reviewer', 'coach', 'judge', 'mentor',
      'organizer', 'experienced_reviewer'
    ]::text[]
  END;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('review-queue:' || caller_id::text || ':' || target_mode, 0)
  );

  UPDATE public.review_assignments AS assignment
  SET status = 'invalidated',
      invalidated_at = now(),
      invalidation_reason = CASE
        WHEN NOT EXISTS (
          SELECT 1 FROM public.pitches AS pitch
          WHERE pitch.id = assignment.pitch_id
            AND pitch.status = 'published'
            AND pitch.deleted_at IS NULL
        ) THEN 'pitch_unavailable'
        WHEN assignment.event_id IS NOT NULL THEN 'event_access_revoked'
        ELSE 'reviewer_ineligible'
      END
  WHERE assignment.reviewer_user_id = caller_id
    AND assignment.reviewer_role = ANY(role_filter)
    AND assignment.status IN ('pending', 'started')
    AND NOT public.is_review_assignment_eligible(assignment.id);

  IF NOT EXISTS (
    SELECT 1
    FROM public.review_assignments AS assignment
    WHERE assignment.reviewer_user_id = caller_id
      AND assignment.reviewer_role = ANY(role_filter)
      AND assignment.status IN ('pending', 'started')
      AND public.is_review_assignment_eligible(assignment.id)
  ) THEN
    IF target_mode = 'reviewer' THEN
      PERFORM claimed.id
      FROM public.claim_trusted_review_assignments(target_limit) AS claimed;
    ELSE
      PERFORM claimed.id
      FROM public.claim_global_review_assignments(target_limit) AS claimed;
    END IF;
  END IF;

  SELECT count(*)::integer
  INTO pending_count
  FROM public.review_assignments AS assignment
  WHERE assignment.reviewer_user_id = caller_id
    AND assignment.reviewer_role = ANY(role_filter)
    AND assignment.status IN ('pending', 'started')
    AND public.is_review_assignment_eligible(assignment.id);

  SELECT coalesce(jsonb_agg(queue_row.payload ORDER BY queue_row.due_at NULLS LAST,
                                                queue_row.created_at,
                                                queue_row.assignment_id), '[]'::jsonb)
  INTO assignments_json
  FROM (
    SELECT assignment.id AS assignment_id,
      assignment.due_at,
      assignment.created_at,
      jsonb_build_object(
        'assignment_id', assignment.id,
        'status', assignment.status,
        'assignment_reason', assignment.assignment_reason,
        'due_at', assignment.due_at,
        'created_at', assignment.created_at,
        'event_slug', event.slug,
        'event_name', event.name,
        'pitch_id', pitch.id,
        'public_id', pitch.public_id,
        'user_id', pitch.user_id,
        'hook', pitch.hook,
        'startup_name', pitch.startup_name,
        'one_line_pitch', pitch.one_line_pitch,
        'feedback_ask', pitch.feedback_ask,
        'video_id', pitch.video_id,
        'thumbnail_url', pitch.thumbnail_url,
        'duration', pitch.duration
      ) AS payload
    FROM public.review_assignments AS assignment
    JOIN public.pitches AS pitch ON pitch.id = assignment.pitch_id
    LEFT JOIN public.pitch_events AS event ON event.id = assignment.event_id
    WHERE assignment.reviewer_user_id = caller_id
      AND assignment.reviewer_role = ANY(role_filter)
      AND assignment.status IN ('pending', 'started')
      AND public.is_review_assignment_eligible(assignment.id)
    ORDER BY assignment.due_at NULLS LAST, assignment.created_at, assignment.id
    LIMIT target_limit
  ) AS queue_row;

  IF target_mode = 'reviewer' THEN
    credits_json := NULL;
  ELSE
    SELECT jsonb_build_object(
      'available', floor(coalesce(credits.balance, 0)::numeric / 2)::integer,
      'pendingBalance', coalesce(credits.pending_balance, 0),
      'earnedCount', coalesce(credits.earned_count, 0),
      'spentCount', coalesce(credits.spent_count, 0),
      'reviewsPerCredit', 2,
      'progress', mod(coalesce(credits.balance, 0), 2)
    )
    INTO credits_json
    FROM (
      SELECT coalesce(max(balance), 0)::integer AS balance,
        coalesce(max(pending_balance), 0)::integer AS pending_balance,
        coalesce(max(earned_count), 0)::integer AS earned_count,
        coalesce(max(spent_count), 0)::integer AS spent_count
      FROM public.review_credits
      WHERE user_id = caller_id
    ) AS credits;
  END IF;

  RETURN jsonb_build_object(
    'assignments', assignments_json,
    'pendingCount', pending_count,
    'credits', credits_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_review_queue_snapshot(integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_review_queue_snapshot(integer, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_review_assignment_detail(target_assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  caller_id uuid := auth.uid();
  assignment_row public.review_assignments;
  result jsonb;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT assignment.*
  INTO assignment_row
  FROM public.review_assignments AS assignment
  WHERE assignment.id = target_assignment_id
    AND assignment.reviewer_user_id = caller_id
  FOR UPDATE;

  IF assignment_row.id IS NULL THEN
    RETURN jsonb_build_object('available', false, 'reason', 'not_found');
  END IF;
  IF assignment_row.status NOT IN ('pending', 'started') THEN
    RETURN jsonb_build_object(
      'available', false,
      'assignment_id', assignment_row.id,
      'status', assignment_row.status,
      'reason', coalesce(assignment_row.invalidation_reason, 'not_available')
    );
  END IF;

  IF NOT public.is_review_assignment_eligible(assignment_row.id) THEN
    UPDATE public.review_assignments
    SET status = 'invalidated',
        invalidated_at = now(),
        invalidation_reason = 'review_access_revoked'
    WHERE id = assignment_row.id;

    RETURN jsonb_build_object(
      'available', false,
      'assignment_id', assignment_row.id,
      'status', 'invalidated',
      'reason', 'review_access_revoked'
    );
  END IF;

  UPDATE public.review_assignments
  SET status = 'started',
      started_at = coalesce(started_at, now())
  WHERE id = assignment_row.id
    AND status = 'pending';

  SELECT jsonb_build_object(
    'available', true,
    'assignment_id', assignment.id,
    'status', assignment.status,
    'event_slug', event.slug,
    'event_name', event.name,
    'pitch', jsonb_build_object(
      'id', pitch.id,
      'public_id', pitch.public_id,
      'user_id', pitch.user_id,
      'hook', pitch.hook,
      'startup_name', pitch.startup_name,
      'one_line_pitch', pitch.one_line_pitch,
      'feedback_ask', pitch.feedback_ask,
      'video_id', pitch.video_id,
      'video_url', pitch.video_url,
      'thumbnail_url', pitch.thumbnail_url,
      'duration', pitch.duration,
      'visibility', pitch.visibility,
      'status', pitch.status,
      'deleted_at', pitch.deleted_at,
      'profiles', jsonb_build_object(
        'id', profile.id,
        'full_name', profile.full_name,
        'avatar_url', profile.avatar_url
      )
    )
  ) INTO result
  FROM public.review_assignments AS assignment
  JOIN public.pitches AS pitch ON pitch.id = assignment.pitch_id
  JOIN public.profiles AS profile ON profile.id = pitch.user_id
  LEFT JOIN public.pitch_events AS event ON event.id = assignment.event_id
  WHERE assignment.id = assignment_row.id;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_review_assignment_detail(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_review_assignment_detail(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_review_queue_snapshot(integer, text) IS
  'Atomically reconciles, claims, counts, and returns the caller review queue.';
COMMENT ON FUNCTION public.get_review_assignment_detail(uuid) IS
  'Locks and starts one eligible caller-owned assignment, or invalidates it without exposing pitch data.';

-- ---------------------------------------------------------------------------
-- Least-privilege feedback projections
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_feedback_history(
  target_limit integer DEFAULT 21,
  target_before_created_at timestamp with time zone DEFAULT NULL,
  target_before_id uuid DEFAULT NULL
)
RETURNS TABLE(
  feedback_id uuid,
  pitch_id uuid,
  pitch_available boolean,
  pitch_public_id text,
  pitch_hook text,
  startup_name text,
  feedback_type text,
  feedback_content text,
  reviewer_role text,
  criterion_key text,
  observation text,
  next_step text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
DECLARE
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF target_limit NOT BETWEEN 1 AND 51 THEN
    RAISE EXCEPTION 'target_limit must be between 1 and 51';
  END IF;
  IF (target_before_created_at IS NULL) <> (target_before_id IS NULL) THEN
    RAISE EXCEPTION 'Both history cursor fields are required';
  END IF;

  RETURN QUERY
  SELECT feedback.id,
    feedback.pitch_id,
    visible_pitch.id IS NOT NULL,
    visible_pitch.public_id,
    visible_pitch.hook,
    visible_pitch.startup_name,
    feedback.type,
    feedback.content,
    feedback.reviewer_role,
    feedback.criterion_key,
    feedback.observation,
    feedback.next_step,
    feedback.created_at
  FROM public.feedback AS feedback
  LEFT JOIN LATERAL (
    SELECT pitch.id, pitch.public_id, pitch.hook, pitch.startup_name
    FROM public.pitches AS pitch
    WHERE pitch.id = feedback.pitch_id
      AND pitch.status = 'published'
      AND pitch.deleted_at IS NULL
      AND public.can_view_pitch(pitch.id)
  ) AS visible_pitch ON true
  WHERE feedback.user_id = caller_id
    AND (
      target_before_created_at IS NULL
      OR (feedback.created_at, feedback.id)
        < (target_before_created_at, target_before_id)
    )
  ORDER BY feedback.created_at DESC, feedback.id DESC
  LIMIT target_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_feedback_history(integer, timestamp with time zone, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_feedback_history(integer, timestamp with time zone, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_founder_pitch_feedback(target_pitch_ids uuid[])
RETURNS TABLE(
  id uuid,
  pitch_id uuid,
  user_id uuid,
  type text,
  content text,
  is_public boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  reviewer_role text,
  event_guideline_version_id uuid,
  criterion_key text,
  observation text,
  next_step text,
  disclosure_mode text,
  reviewer_label text,
  profiles jsonb,
  quality_rating text,
  can_rate_quality boolean,
  reviewer_badge jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
DECLARE
  caller_id uuid := auth.uid();
BEGIN
  IF target_pitch_ids IS NULL OR cardinality(target_pitch_ids) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'target_pitch_ids must contain between 1 and 50 pitches';
  END IF;

  RETURN QUERY
  WITH authorized AS (
    SELECT pitch.id AS pitch_id,
      coalesce(pitch.user_id = caller_id, false) AS is_founder,
      (
        public.is_platform_admin()
        OR EXISTS (
          SELECT 1
          FROM public.pitch_event_submissions AS submission
          WHERE submission.pitch_id = pitch.id
            AND public.can_manage_review_event(submission.event_id)
        )
        OR (
          pitch.event_id IS NOT NULL
          AND public.can_manage_review_event(pitch.event_id)
        )
      ) AS has_accountability_access
    FROM public.pitches AS pitch
    WHERE pitch.id = ANY(target_pitch_ids)
      AND public.can_view_pitch(pitch.id)
  )
  SELECT feedback.id,
    feedback.pitch_id,
    CASE
      WHEN authorized.has_accountability_access OR feedback.disclosure_mode = 'named'
        THEN feedback.user_id
      ELSE NULL
    END,
    feedback.type,
    feedback.content,
    feedback.is_public,
    feedback.created_at,
    feedback.updated_at,
    CASE
      WHEN authorized.has_accountability_access
        OR feedback.disclosure_mode IN ('named', 'role_only')
        THEN feedback.reviewer_role
      ELSE NULL
    END,
    feedback.event_guideline_version_id,
    feedback.criterion_key,
    feedback.observation,
    feedback.next_step,
    feedback.disclosure_mode,
    CASE
      WHEN authorized.has_accountability_access OR feedback.disclosure_mode = 'named'
        THEN coalesce(profile.full_name, 'Reviewer')
      WHEN feedback.disclosure_mode = 'role_only'
        THEN initcap(replace(feedback.reviewer_role, '_', ' '))
      ELSE 'Anonymous reviewer ' || upper(substr(md5(
        feedback.user_id::text || ':' || feedback.pitch_id::text
      ), 1, 4))
    END,
    CASE
      WHEN authorized.has_accountability_access OR feedback.disclosure_mode = 'named'
        THEN jsonb_build_object(
          'id', profile.id,
          'full_name', profile.full_name,
          'avatar_url', profile.avatar_url
        )
      ELSE NULL
    END,
    CASE
      WHEN authorized.is_founder OR authorized.has_accountability_access
        OR feedback.user_id = caller_id
        THEN quality.rating
      ELSE NULL
    END,
    (authorized.is_founder AND feedback.user_id <> caller_id),
    CASE
      WHEN feedback.disclosure_mode = 'anonymous_to_founder'
        AND NOT authorized.has_accountability_access THEN NULL
      WHEN membership.id IS NOT NULL THEN jsonb_build_object(
        'reviewer_roles', membership.reviewer_roles,
        'expertise', membership.expertise,
        'title', membership.title,
        'organization', membership.organization
      )
      ELSE NULL
    END
  FROM public.feedback AS feedback
  JOIN authorized ON authorized.pitch_id = feedback.pitch_id
  LEFT JOIN public.profiles AS profile ON profile.id = feedback.user_id
  LEFT JOIN public.feedback_quality_votes AS quality ON quality.feedback_id = feedback.id
  LEFT JOIN public.trusted_reviewer_memberships AS membership
    ON membership.user_id = feedback.user_id
   AND membership.status = 'active'
  WHERE feedback.is_public
    OR authorized.is_founder
    OR authorized.has_accountability_access
    OR feedback.user_id = caller_id
  ORDER BY feedback.created_at DESC, feedback.id DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_founder_pitch_feedback(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_founder_pitch_feedback(uuid[])
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.can_rate_feedback(target_feedback_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
DECLARE
  caller_id uuid := auth.uid();
  feedback_row record;
BEGIN
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'not_owner',
      'pitch_id', NULL
    );
  END IF;

  SELECT feedback.user_id AS reviewer_id,
    feedback.pitch_id,
    pitch.user_id AS pitch_owner_id
  INTO feedback_row
  FROM public.feedback AS feedback
  JOIN public.pitches AS pitch ON pitch.id = feedback.pitch_id
  WHERE feedback.id = target_feedback_id;

  IF feedback_row.pitch_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'not_found',
      'pitch_id', NULL
    );
  END IF;
  IF feedback_row.reviewer_id = caller_id THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'own_feedback',
      'pitch_id', feedback_row.pitch_id
    );
  END IF;
  IF feedback_row.pitch_owner_id <> caller_id THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'not_owner',
      'pitch_id', feedback_row.pitch_id
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', 'allowed',
    'pitch_id', feedback_row.pitch_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_rate_feedback(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_rate_feedback(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_my_feedback_history(integer, timestamp with time zone, uuid) IS
  'Returns caller-authored feedback using a stable created_at/id cursor without retaining pitch snapshots.';
COMMENT ON FUNCTION public.get_founder_pitch_feedback(uuid[]) IS
  'Returns founder-safe feedback projections and accountable event-manager identity where authorized.';
COMMENT ON FUNCTION public.can_rate_feedback(uuid) IS
  'Authorizes pitch-owner quality ratings without exposing feedback.user_id.';

-- Expand the old column grant so structured feedback can be queried during the
-- application transition. The later contraction removes direct reviewer IDs.
GRANT SELECT (
  event_guideline_version_id,
  criterion_key,
  observation,
  next_step,
  disclosure_mode
) ON public.feedback TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Pitch eligibility writes use a pitch-then-assignment lock order
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reconcile_pitch_review_assignments(target_pitch_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  invalidated_count integer;
BEGIN
  -- The caller must already hold a row lock on the pitch. Lock active queue
  -- rows in stable order before changing any status.
  PERFORM assignment.id
  FROM public.review_assignments AS assignment
  WHERE assignment.pitch_id = target_pitch_id
    AND assignment.status IN ('pending', 'started')
  ORDER BY assignment.id
  FOR UPDATE;

  UPDATE public.review_assignments AS assignment
  SET status = 'invalidated',
      invalidated_at = now(),
      invalidation_reason = CASE
        WHEN pitch.deleted_at IS NOT NULL OR pitch.status <> 'published'
          THEN 'pitch_unavailable'
        WHEN assignment.event_id IS NOT NULL THEN 'event_access_revoked'
        ELSE 'pitch_visibility_changed'
      END
  FROM public.pitches AS pitch
  WHERE pitch.id = target_pitch_id
    AND assignment.pitch_id = pitch.id
    AND assignment.status IN ('pending', 'started')
    AND NOT (
      pitch.status = 'published'
      AND pitch.deleted_at IS NULL
      AND pitch.user_id <> assignment.reviewer_user_id
      AND (
        (assignment.event_id IS NULL AND (
          pitch.visibility = 'public'
          OR (
            assignment.reviewer_role = 'trusted_reviewer'
            AND EXISTS (
              SELECT 1
              FROM public.trusted_reviewer_memberships AS membership
              JOIN public.trusted_reviewer_event_access AS event_access
                ON event_access.membership_id = membership.id
              JOIN public.pitch_event_submissions AS submission
                ON submission.event_id = event_access.event_id
               AND submission.pitch_id = pitch.id
               AND submission.status IN ('submitted', 'locked')
              WHERE membership.user_id = assignment.reviewer_user_id
                AND membership.status = 'active'
            )
          )
        ))
        OR (assignment.event_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.pitch_event_submissions AS submission
            WHERE submission.event_id = assignment.event_id
              AND submission.pitch_id = pitch.id
              AND submission.status IN ('submitted', 'locked')
          )
          AND (
            EXISTS (
              SELECT 1
              FROM public.pitch_event_participants AS participant
              WHERE participant.event_id = assignment.event_id
                AND participant.user_id = assignment.reviewer_user_id
                AND participant.status = 'active'
            )
            OR EXISTS (
              SELECT 1
              FROM public.trusted_reviewer_memberships AS membership
              JOIN public.trusted_reviewer_event_access AS event_access
                ON event_access.membership_id = membership.id
              WHERE membership.user_id = assignment.reviewer_user_id
                AND membership.status = 'active'
                AND event_access.event_id = assignment.event_id
            )
          )
        )
      )
    );

  GET DIAGNOSTICS invalidated_count = ROW_COUNT;
  RETURN invalidated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_pitch_review_assignments(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.update_pitch_visibility_locked(
  target_pitch_id uuid,
  target_visibility text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  caller_id uuid := auth.uid();
  pitch_row public.pitches;
  invalidated_count integer;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF target_visibility NOT IN ('public', 'private') THEN
    RAISE EXCEPTION 'Visibility must be public or private';
  END IF;

  SELECT pitch.* INTO pitch_row
  FROM public.pitches AS pitch
  WHERE pitch.id = target_pitch_id
    AND pitch.user_id = caller_id
    AND pitch.deleted_at IS NULL
  FOR UPDATE;

  IF pitch_row.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.pitches
  SET visibility = target_visibility,
      updated_at = now()
  WHERE id = pitch_row.id
  RETURNING * INTO pitch_row;

  invalidated_count := public.reconcile_pitch_review_assignments(pitch_row.id);

  RETURN jsonb_build_object(
    'id', pitch_row.id,
    'public_id', pitch_row.public_id,
    'visibility', pitch_row.visibility,
    'event_id', pitch_row.event_id,
    'updated_at', pitch_row.updated_at,
    'invalidated_assignments', invalidated_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_pitch_locked(target_pitch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  caller_id uuid := auth.uid();
  pitch_row public.pitches;
  invalidated_count integer;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT pitch.* INTO pitch_row
  FROM public.pitches AS pitch
  WHERE pitch.id = target_pitch_id
    AND pitch.user_id = caller_id
  FOR UPDATE;

  IF pitch_row.id IS NULL THEN
    RETURN jsonb_build_object('deleted', false, 'reason', 'not_found');
  END IF;
  IF pitch_row.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('deleted', false, 'reason', 'already_deleted');
  END IF;

  UPDATE public.pitches
  SET deleted_at = now(),
      updated_at = now()
  WHERE id = pitch_row.id
  RETURNING * INTO pitch_row;

  invalidated_count := public.reconcile_pitch_review_assignments(pitch_row.id);

  RETURN jsonb_build_object(
    'deleted', true,
    'id', pitch_row.id,
    'public_id', pitch_row.public_id,
    'deleted_at', pitch_row.deleted_at,
    'invalidated_assignments', invalidated_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.bind_pitch_to_event_locked(
  target_pitch_id uuid,
  target_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  caller_id uuid := auth.uid();
  pitch_row public.pitches;
  event_row public.pitch_events;
  visibility_changed boolean := false;
  invalidated_count integer := 0;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT event.* INTO event_row
  FROM public.pitch_events AS event
  WHERE event.id = target_event_id;

  IF event_row.id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;
  IF event_row.status = 'locked'
     OR (event_row.submission_deadline IS NOT NULL AND event_row.submission_deadline < now()) THEN
    RAISE EXCEPTION 'Event submissions are closed';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.pitch_event_participants AS participant
    WHERE participant.event_id = event_row.id
      AND participant.user_id = caller_id
      AND participant.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Join the pitch event before submitting a final take';
  END IF;

  SELECT pitch.* INTO pitch_row
  FROM public.pitches AS pitch
  WHERE pitch.id = target_pitch_id
    AND pitch.user_id = caller_id
    AND pitch.deleted_at IS NULL
  FOR UPDATE;

  IF pitch_row.id IS NULL THEN
    RAISE EXCEPTION 'Pitch not found or not owned by caller';
  END IF;

  IF pitch_row.event_id IS NULL THEN
    visibility_changed := pitch_row.visibility = 'public';
    UPDATE public.pitches
    SET event_id = event_row.id,
        visibility = 'private',
        updated_at = now()
    WHERE id = pitch_row.id
    RETURNING * INTO pitch_row;
    invalidated_count := public.reconcile_pitch_review_assignments(pitch_row.id);
  END IF;

  RETURN jsonb_build_object(
    'id', pitch_row.id,
    'public_id', pitch_row.public_id,
    'event_id', pitch_row.event_id,
    'visibility', pitch_row.visibility,
    'visibility_changed', visibility_changed,
    'invalidated_assignments', invalidated_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_pitch_visibility_locked(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.soft_delete_pitch_locked(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bind_pitch_to_event_locked(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_pitch_visibility_locked(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_pitch_locked(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bind_pitch_to_event_locked(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.update_pitch_visibility_locked(uuid, text) IS
  'Owner-scoped visibility update using the pitch-then-assignment lock order.';
COMMENT ON FUNCTION public.soft_delete_pitch_locked(uuid) IS
  'Owner-scoped soft delete that atomically invalidates now-ineligible review assignments.';
COMMENT ON FUNCTION public.bind_pitch_to_event_locked(uuid, uuid) IS
  'Owner-scoped first event binding that atomically reconciles review assignments.';

-- Submission functions take a shared pitch lock before their assignment lock.
-- This pairs with the three pitch mutation RPCs above and prevents a feedback
-- insert from crossing a committed eligibility change.
DO $migration$
DECLARE
  signature regprocedure;
  function_definition text;
  patched_definition text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.submit_pitch_feedback(uuid,text,text,uuid)'::regprocedure,
    'public.submit_event_pitch_feedback(uuid,text,text,uuid,uuid)'::regprocedure
  ] LOOP
    SELECT pg_get_functiondef(signature) INTO function_definition;
    patched_definition := replace(
      function_definition,
      E'    AND pitch.deleted_at IS NULL;\n\n  IF pitch_owner_id',
      E'    AND pitch.deleted_at IS NULL\n  FOR SHARE;\n\n  IF pitch_owner_id'
    );
    IF patched_definition = function_definition THEN
      RAISE EXCEPTION 'Could not add pitch lock to %', signature;
    END IF;
    EXECUTE patched_definition;
  END LOOP;
END;
$migration$;

REVOKE ALL ON FUNCTION public.submit_pitch_feedback(uuid, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_event_pitch_feedback(uuid, text, text, uuid, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_pitch_feedback(uuid, text, text, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_event_pitch_feedback(uuid, text, text, uuid, uuid)
  TO authenticated;
