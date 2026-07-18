-- Make assigned review submission exact, atomic, and safe to retry.
ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS review_assignment_id uuid
    REFERENCES public.review_assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submission_key uuid;

ALTER TABLE public.feedback
  DROP CONSTRAINT IF EXISTS feedback_review_assignment_id_key,
  ADD CONSTRAINT feedback_review_assignment_id_key UNIQUE (review_assignment_id),
  DROP CONSTRAINT IF EXISTS feedback_user_submission_key_key,
  ADD CONSTRAINT feedback_user_submission_key_key UNIQUE (user_id, pitch_id, submission_key);

COMMENT ON COLUMN public.feedback.review_assignment_id IS
  'Exact queue assignment completed by this feedback; null for ordinary feedback.';
COMMENT ON COLUMN public.feedback.submission_key IS
  'Caller-provided idempotency key scoped to the feedback author.';

-- Role snapshots must use the exact assignment selected by the submission RPC.
CREATE OR REPLACE FUNCTION public.snapshot_feedback_reviewer_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pitch_owner_id uuid;
  assignment_role text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.pitch_id IS DISTINCT FROM OLD.pitch_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.review_assignment_id IS DISTINCT FROM OLD.review_assignment_id
       OR NEW.submission_key IS DISTINCT FROM OLD.submission_key THEN
      RAISE EXCEPTION 'Feedback ownership and submission identity cannot be changed';
    END IF;
    NEW.reviewer_role := OLD.reviewer_role;
    RETURN NEW;
  END IF;

  SELECT user_id INTO pitch_owner_id
  FROM public.pitches
  WHERE id = NEW.pitch_id
    AND status = 'published'
    AND deleted_at IS NULL;

  IF pitch_owner_id IS NULL THEN
    RAISE EXCEPTION 'Feedback pitch must exist, be published, and be active';
  END IF;
  IF pitch_owner_id = NEW.user_id THEN
    RAISE EXCEPTION 'A reviewer cannot leave feedback on their own pitch';
  END IF;

  IF NEW.review_assignment_id IS NOT NULL THEN
    SELECT reviewer_role INTO assignment_role
    FROM public.review_assignments
    WHERE id = NEW.review_assignment_id
      AND pitch_id = NEW.pitch_id
      AND reviewer_user_id = NEW.user_id
      AND status IN ('pending', 'started');

    IF assignment_role IS NULL THEN
      RAISE EXCEPTION 'Review assignment is no longer available';
    END IF;
    NEW.reviewer_role := assignment_role;
  ELSE
    NEW.reviewer_role := CASE
      WHEN EXISTS (SELECT 1 FROM public.pitches WHERE user_id = NEW.user_id)
        THEN 'peer_founder'
      ELSE 'public_reviewer'
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Complete only the assignment explicitly linked by the trusted submission RPC.
CREATE OR REPLACE FUNCTION public.process_submitted_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_assignment public.review_assignments;
BEGIN
  IF NEW.review_assignment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO matched_assignment
  FROM public.review_assignments
  WHERE id = NEW.review_assignment_id
    AND pitch_id = NEW.pitch_id
    AND reviewer_user_id = NEW.user_id
    AND status IN ('started', 'pending')
  FOR UPDATE;

  IF matched_assignment.id IS NULL THEN
    RAISE EXCEPTION 'Review assignment is no longer available';
  END IF;

  UPDATE public.review_assignments
  SET status = 'submitted',
      completed_feedback_id = NEW.id,
      completed_at = now()
  WHERE id = matched_assignment.id;

  INSERT INTO public.review_credit_ledger (
    user_id, event_id, feedback_id, assignment_id, bucket, amount,
    entry_type, note
  ) VALUES (
    NEW.user_id, matched_assignment.event_id, NEW.id, matched_assignment.id,
    'pending', 1, 'feedback_submitted', 'Pending assigned-review credit'
  ) ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

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

  IF jsonb_typeof(content_json->'readiness') IS DISTINCT FROM 'number' THEN
    RAISE EXCEPTION 'Feedback content failed validation';
  END IF;
  IF (content_json->>'readiness')::numeric NOT BETWEEN 1 AND 4
     OR trunc((content_json->>'readiness')::numeric) <> (content_json->>'readiness')::numeric THEN
    RAISE EXCEPTION 'Feedback content failed validation';
  END IF;

  IF jsonb_typeof(content_json->'signals') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Feedback content failed validation';
  END IF;
  IF jsonb_array_length(content_json->'signals') NOT BETWEEN 1 AND 3 THEN
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

  IF jsonb_typeof(content_json->'scores') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Feedback content failed validation';
  END IF;
  IF NOT (content_json->'scores' ?& ARRAY['clarity', 'solution', 'market', 'presentation'])
     OR (SELECT count(*) FROM jsonb_object_keys(content_json->'scores')) <> 4 THEN
    RAISE EXCEPTION 'Feedback content failed validation';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_each(content_json->'scores') AS score(key, value)
    WHERE key NOT IN ('clarity', 'solution', 'market', 'presentation')
       OR jsonb_typeof(value) IS DISTINCT FROM 'number'
  ) THEN
    RAISE EXCEPTION 'Feedback content failed validation';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_each(content_json->'scores') AS score(key, value)
    WHERE (value #>> '{}')::numeric NOT BETWEEN 1 AND 10
  ) THEN
    RAISE EXCEPTION 'Feedback content failed validation';
  END IF;

  SELECT user_id INTO pitch_owner_id
  FROM public.pitches
  WHERE id = target_pitch_id
    AND status = 'published'
    AND deleted_at IS NULL;

  IF pitch_owner_id IS NULL THEN
    RAISE EXCEPTION 'Pitch not found';
  END IF;
  IF pitch_owner_id = caller_id THEN
    RAISE EXCEPTION 'A reviewer cannot leave feedback on their own pitch';
  END IF;

  -- Serialize retries and competing submissions for one reviewer/pitch pair.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(caller_id::text || ':' || target_pitch_id::text, 0)
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
    RETURN QUERY SELECT
      saved_feedback.id,
      saved_feedback.type,
      saved_feedback.reviewer_role,
      saved_feedback.created_at,
      saved_feedback.review_assignment_id IS NOT NULL,
      true;
    RETURN;
  END IF;

  SELECT * INTO matched_assignment
  FROM public.review_assignments
  WHERE reviewer_user_id = caller_id
    AND pitch_id = target_pitch_id
    AND status IN ('pending', 'started')
  ORDER BY
    CASE status WHEN 'started' THEN 0 ELSE 1 END,
    due_at ASC NULLS LAST,
    created_at ASC,
    id ASC
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

-- Authenticated clients may read their RLS-visible records, but all marketplace
-- mutations now pass through purpose-built security-definer functions.
REVOKE INSERT, UPDATE, DELETE ON public.feedback FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.review_assignments FROM anon, authenticated;
REVOKE SELECT ON public.feedback FROM anon, authenticated;
GRANT SELECT (
  id, pitch_id, user_id, type, content, is_public,
  created_at, updated_at, reviewer_role
) ON public.feedback TO anon, authenticated;
GRANT SELECT ON public.review_assignments TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can create feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can update their own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can delete their own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Event managers can create assignments" ON public.review_assignments;
DROP POLICY IF EXISTS "Reviewers and event managers can update assignments" ON public.review_assignments;
DROP POLICY IF EXISTS "Event managers can delete assignments" ON public.review_assignments;

GRANT ALL ON public.feedback TO service_role;
GRANT ALL ON public.review_assignments TO service_role;
