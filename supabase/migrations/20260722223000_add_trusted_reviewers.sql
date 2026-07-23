-- Trusted reviewer access for global and event-scoped review work.
--
-- Security boundary:
--   * invitation tokens are stored only as SHA-256 hashes;
--   * invitation, membership, and event-grant management is service-only;
--   * authenticated acceptance is bound to the canonical verified auth email;
--   * RLS checks call SECURITY DEFINER helpers that do not recurse through the
--     protected pitch or event-submission policies.

CREATE TABLE public.trusted_reviewer_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key text NOT NULL UNIQUE DEFAULT (
    'ri_' || encode(gen_random_bytes(16), 'hex')
  ) CHECK (action_key ~ '^ri_[0-9a-f]{32}$'),
  email text NOT NULL CHECK (btrim(email) <> ''),
  normalized_email text GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  token_hash text NOT NULL UNIQUE
    CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  reviewer_roles text[] NOT NULL DEFAULT ARRAY['other']::text[],
  expertise text[] NOT NULL DEFAULT ARRAY[]::text[],
  title text CHECK (title IS NULL OR char_length(title) <= 120),
  organization text CHECK (organization IS NULL OR char_length(organization) <= 160),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days'),
  email_status text NOT NULL DEFAULT 'unknown'
    CHECK (email_status IN ('unknown', 'skipped', 'sent', 'failed', 'not_configured')),
  email_error text,
  email_sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trusted_reviewer_invitations_roles_check CHECK (
    cardinality(reviewer_roles) BETWEEN 1 AND 6
    AND reviewer_roles <@ ARRAY[
      'investor', 'product_leader', 'past_judge', 'mentor', 'operator', 'other'
    ]::text[]
  ),
  CONSTRAINT trusted_reviewer_invitations_expertise_check CHECK (
    cardinality(expertise) <= 12
  ),
  CONSTRAINT trusted_reviewer_invitations_acceptance_state_check CHECK (
    (status = 'accepted' AND accepted_by IS NOT NULL AND accepted_at IS NOT NULL)
    OR
    (status <> 'accepted' AND accepted_by IS NULL AND accepted_at IS NULL)
  )
);

CREATE UNIQUE INDEX trusted_reviewer_invitations_one_pending_email_idx
  ON public.trusted_reviewer_invitations (normalized_email)
  WHERE status = 'pending';

CREATE INDEX trusted_reviewer_invitations_status_expires_idx
  ON public.trusted_reviewer_invitations (status, expires_at);

CREATE INDEX trusted_reviewer_invitations_accepted_by_idx
  ON public.trusted_reviewer_invitations (accepted_by)
  WHERE accepted_by IS NOT NULL;

CREATE TRIGGER update_trusted_reviewer_invitations_updated_at
  BEFORE UPDATE ON public.trusted_reviewer_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.trusted_reviewer_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  invitation_id uuid UNIQUE
    REFERENCES public.trusted_reviewer_invitations(id) ON DELETE SET NULL,
  reviewer_roles text[] NOT NULL DEFAULT ARRAY['other']::text[],
  expertise text[] NOT NULL DEFAULT ARRAY[]::text[],
  title text CHECK (title IS NULL OR char_length(title) <= 120),
  organization text CHECK (organization IS NULL OR char_length(organization) <= 160),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trusted_reviewer_memberships_roles_check CHECK (
    cardinality(reviewer_roles) BETWEEN 1 AND 6
    AND reviewer_roles <@ ARRAY[
      'investor', 'product_leader', 'past_judge', 'mentor', 'operator', 'other'
    ]::text[]
  ),
  CONSTRAINT trusted_reviewer_memberships_expertise_check CHECK (
    cardinality(expertise) <= 12
  ),
  CONSTRAINT trusted_reviewer_memberships_revocation_state_check CHECK (
    (status = 'active' AND revoked_by IS NULL AND revoked_at IS NULL)
    OR
    (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);

CREATE INDEX trusted_reviewer_memberships_status_idx
  ON public.trusted_reviewer_memberships (status, granted_at DESC);

CREATE TRIGGER update_trusted_reviewer_memberships_updated_at
  BEFORE UPDATE ON public.trusted_reviewer_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.trusted_reviewer_event_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL
    REFERENCES public.trusted_reviewer_memberships(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.pitch_events(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trusted_reviewer_event_access_unique_membership_event
    UNIQUE (membership_id, event_id)
);

CREATE INDEX trusted_reviewer_event_access_event_idx
  ON public.trusted_reviewer_event_access (event_id, membership_id);

CREATE TRIGGER update_trusted_reviewer_event_access_updated_at
  BEFORE UPDATE ON public.trusted_reviewer_event_access
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.trusted_reviewer_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_reviewer_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_reviewer_event_access ENABLE ROW LEVEL SECURITY;

-- No browser policies are intentional. Server routes own all management;
-- authenticated callers can only use the narrow acceptance/read helpers below.
REVOKE ALL ON TABLE public.trusted_reviewer_invitations
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.trusted_reviewer_memberships
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.trusted_reviewer_event_access
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.trusted_reviewer_invitations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.trusted_reviewer_memberships TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.trusted_reviewer_event_access TO service_role;

CREATE OR REPLACE FUNCTION public.is_trusted_reviewer()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.trusted_reviewer_memberships AS membership
      WHERE membership.user_id = auth.uid()
        AND membership.status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_trusted_reviewer_for_event(
  target_event_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.trusted_reviewer_memberships AS membership
      JOIN public.trusted_reviewer_event_access AS event_access
        ON event_access.membership_id = membership.id
      WHERE membership.user_id = auth.uid()
        AND membership.status = 'active'
        AND event_access.event_id = target_event_id
    );
$$;

-- This helper is safe for the pitches policy: it reads event submissions as a
-- definer and never queries pitches, so no pitches/submissions RLS cycle forms.
CREATE OR REPLACE FUNCTION public.can_trusted_reviewer_view_pitch(
  target_pitch_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.trusted_reviewer_memberships AS membership
      JOIN public.trusted_reviewer_event_access AS event_access
        ON event_access.membership_id = membership.id
      JOIN public.pitch_event_submissions AS submission
        ON submission.event_id = event_access.event_id
      WHERE membership.user_id = auth.uid()
        AND membership.status = 'active'
        AND submission.pitch_id = target_pitch_id
        AND submission.status IN ('submitted', 'locked')
    );
$$;

-- Feedback authorization can inspect pitches because it is only called from
-- the feedback trigger, not from a pitches RLS policy. Community-published
-- pitches are available to every active trusted reviewer; private event takes
-- additionally require an explicit event grant.
CREATE OR REPLACE FUNCTION public.can_trusted_reviewer_submit_feedback(
  target_pitch_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.trusted_reviewer_memberships AS membership
      JOIN public.pitches AS pitch
        ON pitch.id = target_pitch_id
      WHERE membership.user_id = auth.uid()
        AND membership.status = 'active'
        AND pitch.status = 'published'
        AND pitch.deleted_at IS NULL
        AND (
          pitch.visibility = 'public'
          OR public.can_trusted_reviewer_view_pitch(pitch.id)
        )
    );
$$;

REVOKE ALL ON FUNCTION public.is_trusted_reviewer() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_trusted_reviewer_for_event(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_trusted_reviewer_view_pitch(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_trusted_reviewer_submit_feedback(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_trusted_reviewer()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_trusted_reviewer_for_event(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_trusted_reviewer_view_pitch(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_trusted_reviewer_submit_feedback(uuid)
  TO authenticated, service_role;

-- Trusted reviewer membership is a durable pilot access path. This keeps the
-- existing secure feedback-submission RPC usable without weakening its gate.
CREATE OR REPLACE FUNCTION public.is_pilot_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      public.is_trusted_reviewer()
      OR EXISTS (
        SELECT 1
        FROM public.pilot_members
        WHERE pilot_members.user_id = auth.uid()
      )
      OR public.is_platform_admin()
      OR EXISTS (
        SELECT 1
        FROM public.organizer_invitations
        WHERE lower(organizer_invitations.email) = lower(COALESCE(
          (SELECT auth.users.email FROM auth.users WHERE auth.users.id = auth.uid()),
          auth.jwt() ->> 'email',
          ''
        ))
          AND organizer_invitations.status IN ('pending', 'accepted')
          AND (
            organizer_invitations.expires_at IS NULL
            OR organizer_invitations.expires_at >= now()
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.pitch_event_invitations
        WHERE lower(pitch_event_invitations.email) = lower(COALESCE(
          (SELECT auth.users.email FROM auth.users WHERE auth.users.id = auth.uid()),
          auth.jwt() ->> 'email',
          ''
        ))
          AND pitch_event_invitations.status IN ('pending', 'accepted')
      )
    );
$$;

REVOKE ALL ON FUNCTION public.is_pilot_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_pilot_user()
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.accept_trusted_reviewer_invitation(
  raw_token text
)
RETURNS TABLE (
  accepted boolean,
  invitation_status text,
  membership_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_normalized_email text;
  v_token_hash text;
  v_invitation public.trusted_reviewer_invitations%ROWTYPE;
  v_membership_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Authentication is required to accept this invitation.';
  END IF;

  IF raw_token IS NULL OR length(btrim(raw_token)) < 32 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'This trusted reviewer invitation is invalid or unavailable.';
  END IF;

  SELECT lower(btrim(auth.users.email))
    INTO v_normalized_email
  FROM auth.users
  WHERE auth.users.id = v_user_id
    AND auth.users.email_confirmed_at IS NOT NULL;

  IF v_normalized_email IS NULL OR v_normalized_email = '' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'A verified account email is required to accept this invitation.';
  END IF;

  v_token_hash := encode(
    extensions.digest(convert_to(raw_token, 'UTF8'), 'sha256'),
    'hex'
  );

  SELECT invitation.*
    INTO v_invitation
  FROM public.trusted_reviewer_invitations AS invitation
  WHERE invitation.token_hash = v_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'This trusted reviewer invitation is invalid or unavailable.';
  END IF;

  IF v_invitation.status = 'accepted'
     AND v_invitation.accepted_by = v_user_id
     AND v_invitation.normalized_email = v_normalized_email THEN
    SELECT membership.id
      INTO v_membership_id
    FROM public.trusted_reviewer_memberships AS membership
    WHERE membership.user_id = v_user_id
      AND membership.status = 'active';

    IF v_membership_id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'This trusted reviewer membership is no longer active.';
    END IF;

    RETURN QUERY SELECT true, 'accepted'::text, v_membership_id;
    RETURN;
  END IF;

  IF v_invitation.status <> 'pending' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'This trusted reviewer invitation is invalid or unavailable.';
  END IF;

  IF v_invitation.expires_at <= now() THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'This trusted reviewer invitation has expired.';
  END IF;

  IF v_invitation.normalized_email <> v_normalized_email THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Sign in with the email address that received this invitation.';
  END IF;

  UPDATE public.trusted_reviewer_invitations AS invitation
  SET status = 'accepted',
      accepted_by = v_user_id,
      accepted_at = now(),
      updated_at = now()
  WHERE invitation.id = v_invitation.id;

  INSERT INTO public.trusted_reviewer_memberships (
    user_id,
    invitation_id,
    reviewer_roles,
    expertise,
    title,
    organization,
    status,
    granted_by,
    granted_at,
    revoked_by,
    revoked_at
  ) VALUES (
    v_user_id,
    v_invitation.id,
    v_invitation.reviewer_roles,
    v_invitation.expertise,
    v_invitation.title,
    v_invitation.organization,
    'active',
    v_invitation.invited_by,
    now(),
    NULL,
    NULL
  )
  ON CONFLICT (user_id) DO UPDATE
    SET invitation_id = EXCLUDED.invitation_id,
        reviewer_roles = EXCLUDED.reviewer_roles,
        expertise = EXCLUDED.expertise,
        title = EXCLUDED.title,
        organization = EXCLUDED.organization,
        status = 'active',
        granted_by = EXCLUDED.granted_by,
        granted_at = EXCLUDED.granted_at,
        revoked_by = NULL,
        revoked_at = NULL,
        updated_at = now()
  RETURNING trusted_reviewer_memberships.id INTO v_membership_id;

  RETURN QUERY SELECT true, 'accepted'::text, v_membership_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_trusted_reviewer_invitation(text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.accept_trusted_reviewer_invitation(text)
  TO authenticated;

-- Keep public pitch visibility fail-closed. Event grants never expose drafts,
-- processing rows, or soft-deleted pitches.
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

DROP POLICY IF EXISTS "Users can view their own pitches" ON public.pitches;
CREATE POLICY "Users can view their own pitches"
  ON public.pitches FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Trusted reviewers can view granted event pitches"
  ON public.pitches;
CREATE POLICY "Trusted reviewers can view granted event pitches"
  ON public.pitches FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    AND deleted_at IS NULL
    AND public.can_trusted_reviewer_view_pitch(id)
  );

DROP POLICY IF EXISTS "Submissions are visible to owner and organizers"
  ON public.pitch_event_submissions;
CREATE POLICY "Trusted reviewers can view event submissions"
  ON public.pitch_event_submissions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_pitch_event_owner(event_id)
    OR public.is_pitch_event_member(
      event_id,
      ARRAY['organizer', 'admin', 'coach', 'mentor', 'judge']
    )
    OR public.is_trusted_reviewer_for_event(event_id)
  );

ALTER TABLE public.review_assignments
  DROP CONSTRAINT IF EXISTS review_assignments_reviewer_role_check;

ALTER TABLE public.review_assignments
  ADD CONSTRAINT review_assignments_reviewer_role_check CHECK (
    reviewer_role IN (
      'peer_founder', 'coach', 'mentor', 'judge', 'organizer',
      'experienced_reviewer', 'public_reviewer', 'trusted_reviewer'
    )
  ) NOT VALID;

ALTER TABLE public.review_assignments
  VALIDATE CONSTRAINT review_assignments_reviewer_role_check;

ALTER TABLE public.feedback
  DROP CONSTRAINT IF EXISTS feedback_reviewer_role_check;

ALTER TABLE public.feedback
  ADD CONSTRAINT feedback_reviewer_role_check CHECK (
    reviewer_role IN (
      'peer_founder', 'coach', 'mentor', 'judge', 'organizer',
      'experienced_reviewer', 'public_reviewer', 'trusted_reviewer'
    )
  ) NOT VALID;

ALTER TABLE public.feedback
  VALIDATE CONSTRAINT feedback_reviewer_role_check;

-- Event assignments accept either an active participant or an active trusted
-- reviewer event grant. New global assignments require active trusted status.
-- Updates to legacy global assignments remain completable after this migration.
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
      RAISE EXCEPTION
        'Completed feedback must match the assigned pitch and reviewer';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    caller_can_manage := auth.uid() IS NULL
      OR public.is_platform_admin()
      OR (
        OLD.event_id IS NOT NULL
        AND public.can_manage_review_event(OLD.event_id)
      );

    IF NOT caller_can_manage AND auth.uid() = OLD.reviewer_user_id THEN
      IF NEW.pitch_id IS DISTINCT FROM OLD.pitch_id
         OR NEW.reviewer_user_id IS DISTINCT FROM OLD.reviewer_user_id
         OR NEW.event_id IS DISTINCT FROM OLD.event_id
         OR NEW.reviewer_role IS DISTINCT FROM OLD.reviewer_role
         OR NEW.assignment_reason IS DISTINCT FROM OLD.assignment_reason
         OR NEW.due_at IS DISTINCT FROM OLD.due_at
         OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
         OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION
          'Reviewers cannot change assignment ownership or configuration';
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

REVOKE ALL ON FUNCTION public.validate_review_assignment() FROM PUBLIC;

-- Preserve the existing RPC signature while making global queue eligibility
-- The global queue keeps founders first and preserves the assigned role.
-- on the resulting assignment snapshot.
CREATE OR REPLACE FUNCTION public.claim_global_review_assignments(
  target_count integer DEFAULT 3,
  target_due_at timestamp with time zone DEFAULT (now() + interval '24 hours')
)
RETURNS SETOF public.review_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  role_snapshot text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_pilot_user() THEN
    RAISE EXCEPTION 'Invite-only access is required';
  END IF;

  IF target_count NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'target_count must be between 1 and 10';
  END IF;

  role_snapshot := CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.pitches AS authored_pitch
      WHERE authored_pitch.user_id = auth.uid()
    ) THEN 'peer_founder'
    WHEN public.is_trusted_reviewer() THEN 'trusted_reviewer'
    ELSE 'public_reviewer'
  END;

  -- Serialize queue sizing for one reviewer so concurrent claims cannot exceed
  -- the requested active queue size.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'trusted-reviewer-global:' || auth.uid()::text,
      0
    )
  );

  RETURN QUERY
  WITH current_queue AS (
    SELECT count(*)::integer AS count
    FROM public.review_assignments AS assignment
    JOIN public.pitches AS queued_pitch ON queued_pitch.id = assignment.pitch_id
    WHERE assignment.reviewer_user_id = auth.uid()
      AND assignment.reviewer_role = role_snapshot
      AND assignment.status IN ('pending', 'started')
      AND (
        queued_pitch.visibility = 'public'
        OR (
          role_snapshot = 'trusted_reviewer'
          AND public.can_trusted_reviewer_view_pitch(queued_pitch.id)
        )
      )
  ), candidates AS (
    SELECT pitch.id AS pitch_id
    FROM public.pitches AS pitch
    WHERE pitch.user_id <> auth.uid()
      AND pitch.status = 'published'
      AND pitch.deleted_at IS NULL
      AND (
        pitch.visibility = 'public'
        OR (
          role_snapshot = 'trusted_reviewer'
          AND public.can_trusted_reviewer_view_pitch(pitch.id)
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.review_assignments AS existing
        WHERE existing.pitch_id = pitch.id
          AND existing.reviewer_user_id = auth.uid()
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.feedback AS existing_feedback
        WHERE existing_feedback.pitch_id = pitch.id
          AND existing_feedback.user_id = auth.uid()
      )
    ORDER BY (
      SELECT count(*)
      FROM public.feedback AS submitted_feedback
      WHERE submitted_feedback.pitch_id = pitch.id
    ), pitch.created_at DESC, pitch.id
    LIMIT greatest(target_count - (SELECT count FROM current_queue), 0)
  )
  INSERT INTO public.review_assignments (
    pitch_id,
    reviewer_user_id,
    reviewer_role,
    assignment_reason,
    due_at,
    assigned_by
  )
  SELECT
    candidates.pitch_id,
    auth.uid(),
    role_snapshot,
    'platform_coverage',
    target_due_at,
    auth.uid()
  FROM candidates
  ON CONFLICT DO NOTHING
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_global_review_assignments(
  integer,
  timestamp with time zone
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_global_review_assignments(
  integer,
  timestamp with time zone
) TO authenticated;

-- Reviewer mode is explicit. Dual-role founders use this RPC only after they
-- choose reviewer mode, so trusted attribution cannot leak into founder mode.
CREATE OR REPLACE FUNCTION public.claim_trusted_review_assignments(
  target_count integer DEFAULT 3,
  target_due_at timestamp with time zone DEFAULT (now() + interval '24 hours')
)
RETURNS SETOF public.review_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_pilot_user() OR NOT public.is_trusted_reviewer() THEN
    RAISE EXCEPTION 'Trusted reviewer access is required';
  END IF;

  IF target_count NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'target_count must be between 1 and 10';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('trusted-reviewer-global:' || auth.uid()::text, 0)
  );

  RETURN QUERY
  WITH current_queue AS (
    SELECT count(*)::integer AS count
    FROM public.review_assignments AS assignment
    JOIN public.pitches AS queued_pitch ON queued_pitch.id = assignment.pitch_id
    WHERE assignment.reviewer_user_id = auth.uid()
      AND assignment.reviewer_role = 'trusted_reviewer'
      AND assignment.status IN ('pending', 'started')
      AND (
        queued_pitch.visibility = 'public'
        OR public.can_trusted_reviewer_view_pitch(queued_pitch.id)
      )
  ), candidates AS (
    SELECT
      pitch.id AS pitch_id,
      CASE WHEN pitch.visibility = 'public' THEN NULL ELSE (
        SELECT submission.event_id
        FROM public.pitch_event_submissions AS submission
        WHERE submission.pitch_id = pitch.id
          AND submission.status IN ('submitted', 'locked')
          AND public.is_trusted_reviewer_for_event(submission.event_id)
        ORDER BY submission.submitted_at DESC NULLS LAST, submission.id
        LIMIT 1
      ) END AS event_id
    FROM public.pitches AS pitch
    WHERE pitch.user_id <> auth.uid()
      AND pitch.status = 'published'
      AND pitch.deleted_at IS NULL
      AND (
        pitch.visibility = 'public'
        OR public.can_trusted_reviewer_view_pitch(pitch.id)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.review_assignments AS existing
        WHERE existing.pitch_id = pitch.id
          AND existing.reviewer_user_id = auth.uid()
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.feedback AS existing_feedback
        WHERE existing_feedback.pitch_id = pitch.id
          AND existing_feedback.user_id = auth.uid()
      )
    ORDER BY (
      SELECT count(*)
      FROM public.feedback AS submitted_feedback
      WHERE submitted_feedback.pitch_id = pitch.id
    ), pitch.created_at DESC, pitch.id
    LIMIT greatest(target_count - (SELECT count FROM current_queue), 0)
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
  SELECT
    candidates.pitch_id,
    auth.uid(),
    candidates.event_id,
    'trusted_reviewer',
    'platform_coverage',
    target_due_at,
    auth.uid()
  FROM candidates
  ON CONFLICT DO NOTHING
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_trusted_review_assignments(
  integer,
  timestamp with time zone
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_trusted_review_assignments(
  integer,
  timestamp with time zone
) TO authenticated;

-- Exact assignment linkage remains the first role source. Unassigned feedback
-- snapshots active trusted membership before founder/public fallbacks.
CREATE OR REPLACE FUNCTION public.snapshot_feedback_reviewer_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  pitch_owner_id uuid;
  pitch_visibility text;
  assignment_role text;
  assignment_event_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.pitch_id IS DISTINCT FROM OLD.pitch_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.review_assignment_id IS DISTINCT FROM OLD.review_assignment_id
       OR NEW.submission_key IS DISTINCT FROM OLD.submission_key THEN
      RAISE EXCEPTION
        'Feedback ownership and submission identity cannot be changed';
    END IF;
    NEW.reviewer_role := OLD.reviewer_role;
    RETURN NEW;
  END IF;

  SELECT pitch.user_id, pitch.visibility
    INTO pitch_owner_id, pitch_visibility
  FROM public.pitches AS pitch
  WHERE pitch.id = NEW.pitch_id
    AND pitch.status = 'published'
    AND pitch.deleted_at IS NULL;

  IF pitch_owner_id IS NULL THEN
    RAISE EXCEPTION
      'Feedback pitch must exist, be published, and be active';
  END IF;
  IF pitch_owner_id = NEW.user_id THEN
    RAISE EXCEPTION 'A reviewer cannot leave feedback on their own pitch';
  END IF;
  IF pitch_visibility <> 'public' AND NEW.review_assignment_id IS NULL THEN
    RAISE EXCEPTION 'Private pitch feedback requires an active review assignment';
  END IF;

  IF NEW.review_assignment_id IS NOT NULL THEN
    SELECT assignment.reviewer_role, assignment.event_id
      INTO assignment_role, assignment_event_id
    FROM public.review_assignments AS assignment
    WHERE assignment.id = NEW.review_assignment_id
      AND assignment.pitch_id = NEW.pitch_id
      AND assignment.reviewer_user_id = NEW.user_id
      AND assignment.status IN ('pending', 'started');

    IF assignment_role IS NULL THEN
      RAISE EXCEPTION 'Review assignment is no longer available';
    END IF;
    NEW.reviewer_role := assignment_role;

    IF pitch_visibility <> 'public' THEN
      IF assignment_event_id IS NULL
         OR NOT EXISTS (
           SELECT 1
           FROM public.pitch_event_submissions AS submission
           WHERE submission.event_id = assignment_event_id
             AND submission.pitch_id = NEW.pitch_id
             AND submission.status IN ('submitted', 'locked')
         )
         OR NOT (
           EXISTS (
             SELECT 1
             FROM public.pitch_event_participants AS participant
             WHERE participant.event_id = assignment_event_id
               AND participant.user_id = NEW.user_id
               AND participant.status = 'active'
           )
           OR EXISTS (
             SELECT 1
             FROM public.trusted_reviewer_memberships AS membership
             JOIN public.trusted_reviewer_event_access AS event_access
               ON event_access.membership_id = membership.id
             WHERE membership.user_id = NEW.user_id
               AND membership.status = 'active'
               AND event_access.event_id = assignment_event_id
           )
         ) THEN
        RAISE EXCEPTION
          'Private pitch review access is no longer available';
      END IF;
    END IF;
  ELSE
    NEW.reviewer_role := CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.pitches AS authored_pitch
        WHERE authored_pitch.user_id = NEW.user_id
      ) THEN 'peer_founder'
      WHEN EXISTS (
        SELECT 1
        FROM public.trusted_reviewer_memberships AS membership
        WHERE membership.user_id = NEW.user_id
          AND membership.status = 'active'
      ) THEN 'trusted_reviewer'
      ELSE 'public_reviewer'
    END;
  END IF;

  IF NEW.reviewer_role = 'trusted_reviewer'
     AND NOT public.can_trusted_reviewer_submit_feedback(NEW.pitch_id) THEN
    RAISE EXCEPTION 'Trusted reviewer access denied for this pitch';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.snapshot_feedback_reviewer_role() FROM PUBLIC;

-- One accountable response per reviewer and pitch. The submission RPC handles
-- same-key retries before INSERT, so this guard only rejects a second review.
CREATE OR REPLACE FUNCTION public.prevent_duplicate_pitch_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.feedback AS existing
    WHERE existing.pitch_id = NEW.pitch_id
      AND existing.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'You already reviewed this pitch';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_duplicate_pitch_feedback() FROM PUBLIC;

DROP TRIGGER IF EXISTS prevent_duplicate_pitch_feedback_trigger ON public.feedback;
CREATE TRIGGER prevent_duplicate_pitch_feedback_trigger
  BEFORE INSERT ON public.feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_pitch_feedback();

COMMENT ON TABLE public.trusted_reviewer_invitations IS
  'Email-bound trusted reviewer invitations; only SHA-256 token hashes are stored.';
COMMENT ON TABLE public.trusted_reviewer_memberships IS
  'Service-managed durable trusted reviewer eligibility and revocation state.';
COMMENT ON TABLE public.trusted_reviewer_event_access IS
  'Service-managed active event scopes granted to trusted reviewer memberships; deleting a row revokes its scope.';
COMMENT ON FUNCTION public.accept_trusted_reviewer_invitation(text) IS
  'Accepts an email-bound invitation and atomically grants trusted reviewer membership.';
COMMENT ON FUNCTION public.is_trusted_reviewer() IS
  'Returns whether the authenticated caller has active trusted reviewer membership.';
COMMENT ON FUNCTION public.is_trusted_reviewer_for_event(uuid) IS
  'Returns whether the authenticated trusted reviewer has an active event grant.';
COMMENT ON COLUMN public.feedback.reviewer_role IS
  'Accountable reviewer role snapshot, including active trusted reviewer status.';
