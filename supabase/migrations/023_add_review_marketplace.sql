-- Migration 023: Review marketplace MVP
-- Adds assigned review queues, private feedback quality ratings, soft review
-- credits, reviewer role snapshots, and event pitch-hour configuration.

-- Shared authorization helpers. Event checks delegate to the SECURITY DEFINER
-- helpers from migration 017 so assignment policies never recurse through event
-- participant RLS.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT auth.role() = 'service_role' OR EXISTS (
    SELECT 1
    FROM public.platform_admins
    WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_review_event(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.is_platform_admin()
    OR public.is_pitch_event_owner(target_event_id)
    OR public.is_pitch_event_member(target_event_id, ARRAY['organizer', 'admin']);
$$;

CREATE OR REPLACE FUNCTION public.is_feedback_reviewer(target_feedback_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.feedback
    WHERE id = target_feedback_id
      AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_review_event(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_feedback_reviewer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_review_event(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_feedback_reviewer(uuid) TO authenticated, service_role;

-- Event-level pilot configuration. Credits are deliberately a soft policy: the
-- database records the economy but does not gate pitch submission.
ALTER TABLE public.pitch_events
  ADD COLUMN IF NOT EXISTS review_exchange_policy text NOT NULL DEFAULT 'soft_credits',
  ADD COLUMN IF NOT EXISTS review_target integer,
  ADD COLUMN IF NOT EXISTS pitch_hour_starts_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS pitch_hour_ends_at timestamp with time zone;

ALTER TABLE public.pitch_events
  DROP CONSTRAINT IF EXISTS pitch_events_review_exchange_policy_check,
  DROP CONSTRAINT IF EXISTS pitch_events_review_target_check,
  DROP CONSTRAINT IF EXISTS pitch_events_pitch_hour_window_check;

ALTER TABLE public.pitch_events
  ADD CONSTRAINT pitch_events_review_exchange_policy_check
    CHECK (review_exchange_policy IN ('open', 'soft_credits', 'organizer_override')),
  ADD CONSTRAINT pitch_events_review_target_check
    CHECK (review_target IS NULL OR review_target BETWEEN 1 AND 100),
  ADD CONSTRAINT pitch_events_pitch_hour_window_check
    CHECK (
      (pitch_hour_starts_at IS NULL AND pitch_hour_ends_at IS NULL)
      OR (
        pitch_hour_starts_at IS NOT NULL
        AND pitch_hour_ends_at IS NOT NULL
        AND pitch_hour_ends_at > pitch_hour_starts_at
      )
    );

CREATE INDEX IF NOT EXISTS idx_pitch_events_pitch_hour_starts_at
  ON public.pitch_events(pitch_hour_starts_at)
  WHERE pitch_hour_starts_at IS NOT NULL;

-- Assignment queue.
CREATE TABLE public.review_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id uuid NOT NULL REFERENCES public.pitches(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.pitch_events(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'started', 'submitted')),
  reviewer_role text NOT NULL DEFAULT 'peer_founder'
    CHECK (reviewer_role IN (
      'peer_founder', 'coach', 'mentor', 'judge', 'organizer',
      'experienced_reviewer', 'public_reviewer'
    )),
  assignment_reason text NOT NULL DEFAULT 'coverage_gap'
    CHECK (char_length(trim(assignment_reason)) BETWEEN 1 AND 240),
  due_at timestamp with time zone,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  completed_feedback_id uuid UNIQUE REFERENCES public.feedback(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT review_assignments_completion_check CHECK (
    (status = 'submitted' AND completed_feedback_id IS NOT NULL AND completed_at IS NOT NULL)
    OR (status <> 'submitted' AND completed_feedback_id IS NULL)
  )
);

CREATE UNIQUE INDEX idx_review_assignments_unique_event_review
  ON public.review_assignments(event_id, pitch_id, reviewer_user_id)
  WHERE event_id IS NOT NULL;
CREATE UNIQUE INDEX idx_review_assignments_unique_global_review
  ON public.review_assignments(pitch_id, reviewer_user_id)
  WHERE event_id IS NULL;
CREATE INDEX idx_review_assignments_reviewer_queue
  ON public.review_assignments(reviewer_user_id, status, due_at, created_at);
CREATE INDEX idx_review_assignments_event_coverage
  ON public.review_assignments(event_id, pitch_id, status)
  WHERE event_id IS NOT NULL;
CREATE INDEX idx_review_assignments_pitch_status
  ON public.review_assignments(pitch_id, status);

ALTER TABLE public.review_assignments ENABLE ROW LEVEL SECURITY;

-- Private quality votes. The owner id is stored for efficient policy checks and
-- is always derived from the feedback's pitch by the validation trigger below.
CREATE TABLE public.feedback_quality_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL UNIQUE REFERENCES public.feedback(id) ON DELETE CASCADE,
  pitch_owner_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating text NOT NULL CHECK (rating IN ('useful', 'generic', 'not_helpful')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_quality_votes_owner
  ON public.feedback_quality_votes(pitch_owner_user_id, created_at DESC);
CREATE INDEX idx_feedback_quality_votes_rating
  ON public.feedback_quality_votes(rating, created_at DESC);

ALTER TABLE public.feedback_quality_votes ENABLE ROW LEVEL SECURITY;

-- Append-only soft-credit accounting. Pending credits and spendable credits are
-- separate buckets so quality votes can resolve a pending review without edits.
CREATE TABLE public.review_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.pitch_events(id) ON DELETE SET NULL,
  feedback_id uuid REFERENCES public.feedback(id) ON DELETE SET NULL,
  assignment_id uuid REFERENCES public.review_assignments(id) ON DELETE SET NULL,
  bucket text NOT NULL CHECK (bucket IN ('pending', 'available', 'discounted')),
  amount integer NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN (
    'feedback_submitted', 'quality_resolved', 'quality_earned',
    'quality_earned_reversed', 'quality_discounted',
    'quality_discounted_reversed', 'request_spent', 'manual_adjustment'
  )),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT review_credit_ledger_amount_check CHECK (
    amount <> 0 OR bucket = 'discounted'
  ),
  CONSTRAINT review_credit_ledger_entry_shape_check CHECK (
    (entry_type = 'feedback_submitted' AND bucket = 'pending' AND amount = 1)
    OR (entry_type = 'quality_resolved' AND bucket = 'pending' AND amount = -1)
    OR (entry_type = 'quality_earned' AND bucket = 'available' AND amount = 1)
    OR (entry_type = 'quality_earned_reversed' AND bucket = 'available' AND amount = -1)
    OR (entry_type IN ('quality_discounted', 'quality_discounted_reversed')
      AND bucket = 'discounted' AND amount = 0)
    OR (entry_type = 'request_spent' AND bucket = 'available' AND amount < 0)
    OR (entry_type = 'manual_adjustment' AND bucket IN ('pending', 'available'))
  )
);

CREATE UNIQUE INDEX idx_review_credit_ledger_feedback_submitted
  ON public.review_credit_ledger(feedback_id, entry_type)
  WHERE entry_type = 'feedback_submitted' AND feedback_id IS NOT NULL;
CREATE INDEX idx_review_credit_ledger_user_created
  ON public.review_credit_ledger(user_id, created_at DESC);
CREATE INDEX idx_review_credit_ledger_event_created
  ON public.review_credit_ledger(event_id, created_at DESC)
  WHERE event_id IS NOT NULL;
CREATE INDEX idx_review_credit_ledger_feedback
  ON public.review_credit_ledger(feedback_id)
  WHERE feedback_id IS NOT NULL;

ALTER TABLE public.review_credit_ledger ENABLE ROW LEVEL SECURITY;

-- Snapshot the accountable reviewer role on every feedback row. Existing rows
-- are conservatively classified by whether the reviewer has authored a pitch.
ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS reviewer_role text;

UPDATE public.feedback AS f
SET reviewer_role = CASE
  WHEN EXISTS (SELECT 1 FROM public.pitches p WHERE p.user_id = f.user_id)
    THEN 'peer_founder'
  ELSE 'public_reviewer'
END
WHERE reviewer_role IS NULL;

ALTER TABLE public.feedback
  ALTER COLUMN reviewer_role SET DEFAULT 'public_reviewer',
  ALTER COLUMN reviewer_role SET NOT NULL,
  DROP CONSTRAINT IF EXISTS feedback_reviewer_role_check;

ALTER TABLE public.feedback
  ADD CONSTRAINT feedback_reviewer_role_check CHECK (reviewer_role IN (
    'peer_founder', 'coach', 'mentor', 'judge', 'organizer',
    'experienced_reviewer', 'public_reviewer'
  ));

CREATE INDEX IF NOT EXISTS idx_feedback_reviewer_role
  ON public.feedback(reviewer_role, created_at DESC);

-- Validate assignment linkage and protect queue ownership from reviewer edits.
CREATE OR REPLACE FUNCTION public.validate_review_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pitch_owner_id uuid;
  participant_role text;
  feedback_pitch_id uuid;
  feedback_reviewer_id uuid;
  caller_can_manage boolean;
BEGIN
  SELECT user_id INTO pitch_owner_id
  FROM public.pitches
  WHERE id = NEW.pitch_id AND deleted_at IS NULL;

  IF pitch_owner_id IS NULL THEN
    RAISE EXCEPTION 'Review assignment pitch must exist and be active';
  END IF;

  IF pitch_owner_id = NEW.reviewer_user_id THEN
    RAISE EXCEPTION 'A reviewer cannot be assigned their own pitch';
  END IF;

  IF NEW.event_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pitch_event_submissions
      WHERE event_id = NEW.event_id
        AND pitch_id = NEW.pitch_id
        AND status IN ('submitted', 'locked')
    ) THEN
      RAISE EXCEPTION 'Assigned pitch is not submitted to the selected event';
    END IF;

    SELECT role INTO participant_role
    FROM public.pitch_event_participants
    WHERE event_id = NEW.event_id
      AND user_id = NEW.reviewer_user_id
      AND status = 'active';

    IF participant_role IS NULL THEN
      RAISE EXCEPTION 'Assigned reviewer is not an active event participant';
    END IF;

    NEW.reviewer_role := CASE participant_role
      WHEN 'founder' THEN 'peer_founder'
      WHEN 'admin' THEN 'organizer'
      ELSE participant_role
    END;
  END IF;

  IF NEW.completed_feedback_id IS NOT NULL THEN
    SELECT pitch_id, user_id
      INTO feedback_pitch_id, feedback_reviewer_id
    FROM public.feedback
    WHERE id = NEW.completed_feedback_id;

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
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_review_assignment_before_write
  BEFORE INSERT OR UPDATE ON public.review_assignments
  FOR EACH ROW EXECUTE FUNCTION public.validate_review_assignment();

REVOKE ALL ON FUNCTION public.validate_review_assignment() FROM PUBLIC;

-- Derive the public role label from a managed assignment where possible. Direct
-- feedback outside a queue is classified only as peer founder/public reviewer.
CREATE OR REPLACE FUNCTION public.snapshot_feedback_reviewer_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.reviewer_role := OLD.reviewer_role;
    RETURN NEW;
  END IF;

  SELECT reviewer_role INTO NEW.reviewer_role
  FROM public.review_assignments
  WHERE pitch_id = NEW.pitch_id
    AND reviewer_user_id = NEW.user_id
    AND status IN ('pending', 'started')
  ORDER BY created_at DESC
  LIMIT 1;

  IF NEW.reviewer_role IS NULL THEN
    NEW.reviewer_role := CASE
      WHEN EXISTS (SELECT 1 FROM public.pitches WHERE user_id = NEW.user_id)
        THEN 'peer_founder'
      ELSE 'public_reviewer'
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER snapshot_feedback_reviewer_role_before_write
  BEFORE INSERT OR UPDATE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_feedback_reviewer_role();

REVOKE ALL ON FUNCTION public.snapshot_feedback_reviewer_role() FROM PUBLIC;

-- Complete the matching queue item and grant one pending soft credit whenever a
-- review is submitted. The unique ledger index makes this retry-safe.
CREATE OR REPLACE FUNCTION public.process_submitted_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_assignment public.review_assignments;
  pitch_owner_id uuid;
BEGIN
  SELECT * INTO matched_assignment
  FROM public.review_assignments
  WHERE pitch_id = NEW.pitch_id
    AND reviewer_user_id = NEW.user_id
    AND status IN ('started', 'pending')
  ORDER BY CASE status WHEN 'started' THEN 0 ELSE 1 END, created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF matched_assignment.id IS NOT NULL THEN
    UPDATE public.review_assignments
    SET status = 'submitted',
        completed_feedback_id = NEW.id,
        completed_at = now()
    WHERE id = matched_assignment.id;
  END IF;

  SELECT user_id INTO pitch_owner_id
  FROM public.pitches
  WHERE id = NEW.pitch_id;

  IF pitch_owner_id IS DISTINCT FROM NEW.user_id THEN
    INSERT INTO public.review_credit_ledger (
      user_id, event_id, feedback_id, assignment_id, bucket, amount,
      entry_type, note
    ) VALUES (
      NEW.user_id, matched_assignment.event_id, NEW.id, matched_assignment.id,
      'pending', 1, 'feedback_submitted', 'Pending review credit'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER process_submitted_review_after_insert
  AFTER INSERT ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.process_submitted_review();

REVOKE ALL ON FUNCTION public.process_submitted_review() FROM PUBLIC;

-- Quality vote ownership is always derived, never trusted from the client.
CREATE OR REPLACE FUNCTION public.validate_feedback_quality_vote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expected_owner_id uuid;
BEGIN
  SELECT p.user_id INTO expected_owner_id
  FROM public.feedback f
  JOIN public.pitches p ON p.id = f.pitch_id
  WHERE f.id = NEW.feedback_id;

  IF expected_owner_id IS NULL THEN
    RAISE EXCEPTION 'Feedback quality vote must reference valid feedback';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.feedback_id IS DISTINCT FROM OLD.feedback_id THEN
    RAISE EXCEPTION 'A quality vote cannot be moved to different feedback';
  END IF;

  NEW.pitch_owner_user_id := expected_owner_id;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_feedback_quality_vote_before_write
  BEFORE INSERT OR UPDATE ON public.feedback_quality_votes
  FOR EACH ROW EXECUTE FUNCTION public.validate_feedback_quality_vote();

REVOKE ALL ON FUNCTION public.validate_feedback_quality_vote() FROM PUBLIC;

-- Resolve pending credits and append/reverse earned entries as a rating changes.
CREATE OR REPLACE FUNCTION public.process_feedback_quality_credit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reviewer_user_id uuid;
  source_event_id uuid;
  source_assignment_id uuid;
  has_pending_credit boolean;
BEGIN
  SELECT f.user_id, ra.event_id, ra.id
    INTO reviewer_user_id, source_event_id, source_assignment_id
  FROM public.feedback f
  LEFT JOIN public.review_assignments ra ON ra.completed_feedback_id = f.id
  WHERE f.id = COALESCE(NEW.feedback_id, OLD.feedback_id);

  IF TG_OP = 'UPDATE' AND NEW.rating = OLD.rating THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.review_credit_ledger
    WHERE feedback_id = COALESCE(NEW.feedback_id, OLD.feedback_id)
      AND entry_type = 'feedback_submitted'
  ) INTO has_pending_credit;

  IF TG_OP = 'INSERT' AND has_pending_credit THEN
    INSERT INTO public.review_credit_ledger (
      user_id, event_id, feedback_id, assignment_id, bucket, amount, entry_type, note
    ) VALUES (
      reviewer_user_id, source_event_id, NEW.feedback_id, source_assignment_id,
      'pending', -1, 'quality_resolved', 'Pending credit resolved by pitch owner'
    );
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.rating = 'useful' THEN
    INSERT INTO public.review_credit_ledger (
      user_id, event_id, feedback_id, assignment_id, bucket, amount, entry_type, note
    ) VALUES (
      reviewer_user_id, source_event_id, OLD.feedback_id, source_assignment_id,
      'available', -1, 'quality_earned_reversed', 'Useful rating removed or changed'
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.review_credit_ledger (
      user_id, event_id, feedback_id, assignment_id, bucket, amount, entry_type, note
    ) VALUES (
      reviewer_user_id, source_event_id, OLD.feedback_id, source_assignment_id,
      'discounted', 0, 'quality_discounted_reversed', 'Discounted rating removed or changed'
    );
  END IF;

  IF NEW.rating = 'useful' THEN
    INSERT INTO public.review_credit_ledger (
      user_id, event_id, feedback_id, assignment_id, bucket, amount, entry_type, note
    ) VALUES (
      reviewer_user_id, source_event_id, NEW.feedback_id, source_assignment_id,
      'available', 1, 'quality_earned', 'Pitch owner marked feedback useful'
    );
  ELSE
    INSERT INTO public.review_credit_ledger (
      user_id, event_id, feedback_id, assignment_id, bucket, amount, entry_type, note
    ) VALUES (
      reviewer_user_id, source_event_id, NEW.feedback_id, source_assignment_id,
      'discounted', 0, 'quality_discounted', 'Pitch owner marked feedback generic or not helpful'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER process_feedback_quality_credit_after_write
  AFTER INSERT OR UPDATE ON public.feedback_quality_votes
  FOR EACH ROW EXECUTE FUNCTION public.process_feedback_quality_credit();

REVOKE ALL ON FUNCTION public.process_feedback_quality_credit() FROM PUBLIC;

-- Generate a small event queue, prioritizing pitches with the least assignment
-- coverage. This helper is intentionally simple for the controlled pilot.
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
    SELECT pep.user_id,
      CASE pep.role
        WHEN 'founder' THEN 'peer_founder'
        WHEN 'admin' THEN 'organizer'
        ELSE pep.role
      END AS role_snapshot,
      GREATEST(
        target_per_reviewer - COUNT(ra.id) FILTER (
          WHERE ra.status IN ('pending', 'started')
        )::integer,
        0
      ) AS slots
    FROM public.pitch_event_participants pep
    LEFT JOIN public.review_assignments ra
      ON ra.event_id = pep.event_id AND ra.reviewer_user_id = pep.user_id
    WHERE pep.event_id = target_event_id
      AND pep.status = 'active'
    GROUP BY pep.user_id, pep.role
  ), candidates AS (
    SELECT r.user_id AS reviewer_user_id,
      r.role_snapshot,
      choice.pitch_id
    FROM reviewers r
    CROSS JOIN LATERAL (
      SELECT pes.pitch_id
      FROM public.pitch_event_submissions pes
      JOIN public.pitches p ON p.id = pes.pitch_id
      WHERE pes.event_id = target_event_id
        AND pes.status IN ('submitted', 'locked')
        AND p.deleted_at IS NULL
        AND p.user_id <> r.user_id
        AND NOT EXISTS (
          SELECT 1 FROM public.review_assignments existing
          WHERE existing.pitch_id = pes.pitch_id
            AND existing.reviewer_user_id = r.user_id
        )
      ORDER BY (
        SELECT COUNT(*) FROM public.review_assignments coverage
        WHERE coverage.event_id = target_event_id
          AND coverage.pitch_id = pes.pitch_id
          AND coverage.status IN ('pending', 'started', 'submitted')
      ), pes.submitted_at, pes.pitch_id
      LIMIT r.slots
    ) choice
  )
  INSERT INTO public.review_assignments (
    pitch_id, reviewer_user_id, event_id, reviewer_role, assignment_reason,
    due_at, assigned_by
  )
  SELECT pitch_id, reviewer_user_id, target_event_id, role_snapshot,
    'event_coverage', target_due_at, auth.uid()
  FROM candidates
  ON CONFLICT DO NOTHING
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_review_assignments(uuid, integer, timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_review_assignments(uuid, integer, timestamp with time zone)
  TO authenticated, service_role;

-- Admin-only soft-credit adjustments for live pilot overrides.
CREATE OR REPLACE FUNCTION public.adjust_review_credits(
  target_user_id uuid,
  credit_amount integer,
  target_event_id uuid DEFAULT NULL,
  adjustment_note text DEFAULT NULL
)
RETURNS public.review_credit_ledger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ledger_entry public.review_credit_ledger;
BEGIN
  IF credit_amount = 0 THEN
    RAISE EXCEPTION 'credit_amount cannot be zero';
  END IF;

  IF NOT (
    public.is_platform_admin()
    OR (target_event_id IS NOT NULL AND public.can_manage_review_event(target_event_id))
  ) THEN
    RAISE EXCEPTION 'Not authorized to adjust review credits';
  END IF;

  IF target_event_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.pitch_event_participants
    WHERE event_id = target_event_id
      AND user_id = target_user_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Credit recipient must be an active event participant';
  END IF;

  INSERT INTO public.review_credit_ledger (
    user_id, event_id, bucket, amount, entry_type, note, created_by
  ) VALUES (
    target_user_id, target_event_id, 'available', credit_amount,
    'manual_adjustment', adjustment_note, auth.uid()
  )
  RETURNING * INTO ledger_entry;

  RETURN ledger_entry;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_review_credits(uuid, integer, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_review_credits(uuid, integer, uuid, text)
  TO authenticated, service_role;

-- RLS: reviewers see only their own queue; event managers see event coverage;
-- platform admins retain the audit access required by the pilot.
CREATE POLICY "Reviewers and event managers can view assignments"
  ON public.review_assignments FOR SELECT
  USING (
    reviewer_user_id = auth.uid()
    OR public.is_platform_admin()
    OR (event_id IS NOT NULL AND public.can_manage_review_event(event_id))
  );

CREATE POLICY "Event managers can create assignments"
  ON public.review_assignments FOR INSERT
  WITH CHECK (
    public.is_platform_admin()
    OR (event_id IS NOT NULL AND public.can_manage_review_event(event_id))
  );

CREATE POLICY "Reviewers and event managers can update assignments"
  ON public.review_assignments FOR UPDATE
  USING (
    reviewer_user_id = auth.uid()
    OR public.is_platform_admin()
    OR (event_id IS NOT NULL AND public.can_manage_review_event(event_id))
  )
  WITH CHECK (
    reviewer_user_id = auth.uid()
    OR public.is_platform_admin()
    OR (event_id IS NOT NULL AND public.can_manage_review_event(event_id))
  );

CREATE POLICY "Event managers can delete assignments"
  ON public.review_assignments FOR DELETE
  USING (
    public.is_platform_admin()
    OR (event_id IS NOT NULL AND public.can_manage_review_event(event_id))
  );

-- Ratings are private to the pitch owner and the reviewer who authored the
-- feedback. Only the pitch owner may create or change the rating.
CREATE POLICY "Pitch owners and reviewers can view quality votes"
  ON public.feedback_quality_votes FOR SELECT
  USING (
    pitch_owner_user_id = auth.uid()
    OR public.is_platform_admin()
    OR public.is_feedback_reviewer(feedback_id)
  );

CREATE POLICY "Pitch owners can create quality votes"
  ON public.feedback_quality_votes FOR INSERT
  WITH CHECK (pitch_owner_user_id = auth.uid());

CREATE POLICY "Pitch owners can update quality votes"
  ON public.feedback_quality_votes FOR UPDATE
  USING (pitch_owner_user_id = auth.uid())
  WITH CHECK (pitch_owner_user_id = auth.uid());

CREATE POLICY "Users and event managers can view credit entries"
  ON public.review_credit_ledger FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_platform_admin()
    OR (event_id IS NOT NULL AND public.can_manage_review_event(event_id))
  );

-- RLS applies to this invoker-security balance view, preventing cross-user
-- balance disclosure while keeping client queries simple.
CREATE VIEW public.review_credits
WITH (security_invoker = true)
AS
SELECT
  user_id,
  COALESCE(SUM(amount) FILTER (WHERE bucket = 'available'), 0)::integer AS balance,
  COALESCE(SUM(amount) FILTER (WHERE bucket = 'pending'), 0)::integer AS pending_balance,
  (
    COUNT(*) FILTER (WHERE entry_type = 'quality_earned')
    - COUNT(*) FILTER (WHERE entry_type = 'quality_earned_reversed')
  )::integer AS earned_count,
  COALESCE(
    -SUM(amount) FILTER (WHERE entry_type = 'request_spent'),
    0
  )::integer AS spent_count
FROM public.review_credit_ledger
GROUP BY user_id;

REVOKE ALL ON public.review_assignments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.feedback_quality_votes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.review_credit_ledger FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.review_credits FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.feedback_quality_votes TO authenticated;
GRANT SELECT ON public.review_credit_ledger TO authenticated;
GRANT SELECT ON public.review_credits TO authenticated;

GRANT ALL ON public.review_assignments TO service_role;
GRANT ALL ON public.feedback_quality_votes TO service_role;
GRANT ALL ON public.review_credit_ledger TO service_role;
GRANT SELECT ON public.review_credits TO service_role;

COMMENT ON TABLE public.review_assignments IS 'Event-scoped and platform review queue assignments.';
COMMENT ON TABLE public.feedback_quality_votes IS 'Private pitch-owner quality ratings visible only to the owner and relevant reviewer.';
COMMENT ON TABLE public.review_credit_ledger IS 'Append-only soft-credit ledger; it does not enforce a pitch submission gate.';
COMMENT ON COLUMN public.feedback.reviewer_role IS 'Accountable reviewer role snapshot captured when feedback is submitted.';
COMMENT ON COLUMN public.pitch_events.review_target IS 'Optional target number of reviews per submitted pitch.';
