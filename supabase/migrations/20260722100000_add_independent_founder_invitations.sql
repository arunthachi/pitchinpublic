-- Independent founder invitations for the invite-only pilot.
--
-- Security boundary:
--   * raw invitation tokens are never persisted;
--   * browser roles cannot read or mutate invitation records directly;
--   * acceptance derives identity from auth.uid() and the canonical auth email;
--   * successful acceptance and durable pilot membership are one transaction.

CREATE TABLE IF NOT EXISTS public.founder_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (btrim(email) <> ''),
  normalized_email text GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  token_hash text NOT NULL UNIQUE
    CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  cohort text CHECK (cohort IS NULL OR btrim(cohort) <> ''),
  source text CHECK (source IS NULL OR btrim(source) <> ''),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT founder_invitations_acceptance_state_check CHECK (
    (status = 'accepted' AND accepted_by IS NOT NULL AND accepted_at IS NOT NULL)
    OR
    (status <> 'accepted' AND accepted_by IS NULL AND accepted_at IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS founder_invitations_one_pending_per_email_idx
  ON public.founder_invitations (normalized_email)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS founder_invitations_status_expires_idx
  ON public.founder_invitations (status, expires_at);

CREATE INDEX IF NOT EXISTS founder_invitations_invited_by_idx
  ON public.founder_invitations (invited_by, created_at DESC);

CREATE INDEX IF NOT EXISTS founder_invitations_accepted_by_idx
  ON public.founder_invitations (accepted_by)
  WHERE accepted_by IS NOT NULL;

DROP TRIGGER IF EXISTS update_founder_invitations_updated_at
  ON public.founder_invitations;
CREATE TRIGGER update_founder_invitations_updated_at
  BEFORE UPDATE ON public.founder_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.founder_invitation_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid REFERENCES public.founder_invitations(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (
    action IN (
      'created',
      'resent',
      'revoked',
      'accepted',
      'membership_granted',
      'membership_revoked',
      'acceptance_rejected'
    )
  ),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT founder_invitation_audit_metadata_object_check CHECK (
    jsonb_typeof(metadata) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS founder_invitation_audit_invitation_created_idx
  ON public.founder_invitation_audit_events (invitation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS founder_invitation_audit_actor_created_idx
  ON public.founder_invitation_audit_events (actor_user_id, created_at DESC)
  WHERE actor_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.founder_invitation_email_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL
    REFERENCES public.founder_invitations(id) ON DELETE CASCADE,
  attempted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'resend',
  provider_message_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sent', 'delivered', 'failed', 'bounced', 'complained')
  ),
  failure_category text,
  request_id text,
  attempted_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT founder_invitation_email_metadata_object_check CHECK (
    jsonb_typeof(metadata) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS founder_invitation_email_invitation_attempted_idx
  ON public.founder_invitation_email_attempts (invitation_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS founder_invitation_email_provider_message_idx
  ON public.founder_invitation_email_attempts (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE public.founder_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_invitation_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_invitation_email_attempts ENABLE ROW LEVEL SECURITY;

-- Deliberately no RLS policies: service-role server routes own administration.
REVOKE ALL ON TABLE public.founder_invitations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.founder_invitation_audit_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.founder_invitation_email_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.founder_invitations TO service_role;
GRANT SELECT, INSERT
  ON TABLE public.founder_invitation_audit_events TO service_role;
GRANT SELECT, INSERT, UPDATE
  ON TABLE public.founder_invitation_email_attempts TO service_role;

-- Extend the durable membership registry without changing existing rows.
ALTER TABLE public.pilot_members
  DROP CONSTRAINT IF EXISTS pilot_members_source_check;

ALTER TABLE public.pilot_members
  ADD CONSTRAINT pilot_members_source_check CHECK (
    source IN (
      'existing_account',
      'manual',
      'organizer_invite',
      'event_invite',
      'founder_invite'
    )
  ) NOT VALID;

ALTER TABLE public.pilot_members
  VALIDATE CONSTRAINT pilot_members_source_check;

CREATE OR REPLACE FUNCTION public.accept_founder_invitation(raw_token text)
RETURNS TABLE (
  accepted boolean,
  invitation_status text,
  cohort text,
  source text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_normalized_email text;
  v_token_hash text;
  v_invitation public.founder_invitations%ROWTYPE;
  v_membership_was_present boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Authentication is required to accept this invitation.';
  END IF;

  IF raw_token IS NULL OR length(btrim(raw_token)) < 32 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'This founder invitation is invalid or unavailable.';
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

  SELECT founder_invitations.*
    INTO v_invitation
  FROM public.founder_invitations
  WHERE founder_invitations.token_hash = v_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'This founder invitation is invalid or unavailable.';
  END IF;

  -- Repeating acceptance with the same account is safe and repairs a missing
  -- durable membership if a previous caller was interrupted after acceptance.
  IF v_invitation.status = 'accepted'
     AND v_invitation.accepted_by = v_user_id
     AND v_invitation.normalized_email = v_normalized_email THEN
    INSERT INTO public.pilot_members (user_id, source, granted_at, granted_by)
    VALUES (
      v_user_id,
      'founder_invite',
      COALESCE(v_invitation.accepted_at, now()),
      v_invitation.invited_by
    )
    ON CONFLICT (user_id) DO UPDATE
      SET source = 'founder_invite',
          granted_by = COALESCE(
            public.pilot_members.granted_by,
            EXCLUDED.granted_by
          );

    RETURN QUERY SELECT
      true,
      v_invitation.status,
      v_invitation.cohort,
      v_invitation.source;
    RETURN;
  END IF;

  IF v_invitation.status <> 'pending' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'This founder invitation is invalid or unavailable.';
  END IF;

  IF v_invitation.expires_at <= now() THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'This founder invitation has expired.';
  END IF;

  IF v_invitation.normalized_email <> v_normalized_email THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Sign in with the email address that received this invitation.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.pilot_members
    WHERE pilot_members.user_id = v_user_id
  ) INTO v_membership_was_present;

  UPDATE public.founder_invitations
  SET status = 'accepted',
      accepted_by = v_user_id,
      accepted_at = now(),
      updated_at = now()
  WHERE founder_invitations.id = v_invitation.id;

  INSERT INTO public.pilot_members (user_id, source, granted_at, granted_by)
  VALUES (v_user_id, 'founder_invite', now(), v_invitation.invited_by)
  ON CONFLICT (user_id) DO UPDATE
    SET source = 'founder_invite',
        granted_by = COALESCE(
          public.pilot_members.granted_by,
          EXCLUDED.granted_by
        );

  INSERT INTO public.founder_invitation_audit_events (
    invitation_id,
    action,
    actor_user_id,
    metadata
  )
  VALUES (
    v_invitation.id,
    'accepted',
    v_user_id,
    jsonb_build_object(
      'cohort', v_invitation.cohort,
      'source', v_invitation.source
    )
  );

  IF NOT v_membership_was_present THEN
    INSERT INTO public.founder_invitation_audit_events (
      invitation_id,
      action,
      actor_user_id,
      metadata
    )
    VALUES (
      v_invitation.id,
      'membership_granted',
      v_user_id,
      jsonb_build_object('membership_source', 'founder_invite')
    );
  END IF;

  RETURN QUERY SELECT
    true,
    'accepted'::text,
    v_invitation.cohort,
    v_invitation.source;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_founder_invitation(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_founder_invitation(text) FROM anon;
REVOKE ALL ON FUNCTION public.accept_founder_invitation(text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.accept_founder_invitation(text) TO authenticated;

-- Preserve every existing pilot access path. Founder invitations become app
-- access only through the durable pilot_members row created by acceptance; a
-- pending or historical invitation never independently authorizes app data.
CREATE OR REPLACE FUNCTION public.is_pilot_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      EXISTS (
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
GRANT EXECUTE ON FUNCTION public.is_pilot_user() TO authenticated, service_role;

COMMENT ON TABLE public.founder_invitations IS
  'Email-bound independent founder invitations. Only SHA-256 token hashes are stored.';
COMMENT ON COLUMN public.founder_invitations.normalized_email IS
  'Generated canonical email used for uniqueness and authenticated identity matching.';
COMMENT ON COLUMN public.founder_invitations.token_hash IS
  'Lowercase hex SHA-256 hash of a high-entropy raw token; raw tokens are never persisted.';
COMMENT ON COLUMN public.founder_invitations.cohort IS
  'Optional pilot cohort label used for operational segmentation.';
COMMENT ON COLUMN public.founder_invitations.source IS
  'Optional acquisition or invitation source label.';
COMMENT ON TABLE public.founder_invitation_audit_events IS
  'Append-oriented security and lifecycle events for independent founder invitations.';
COMMENT ON TABLE public.founder_invitation_email_attempts IS
  'Historical founder invitation email delivery attempts and sanitized provider outcomes.';
COMMENT ON FUNCTION public.accept_founder_invitation(text) IS
  'Atomically accepts an email-bound founder invitation and grants durable pilot membership.';
