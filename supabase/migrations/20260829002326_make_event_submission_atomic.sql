-- Submit a legacy event final take and establish its event/privacy binding in
-- one transaction. A raised exception rolls back both the pitch update and the
-- submission upsert, so callers can never observe a submitted row whose pitch
-- is still public or belongs to another event.

DO $migration$
BEGIN
EXECUTE $guard$
CREATE OR REPLACE FUNCTION public.prevent_pitch_binding_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $trigger$
DECLARE
  binding_context text := current_setting('app.atomic_event_pitch_binding', true);
  request_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
  trusted_backend boolean := (
    request_role = 'service_role'
    OR (request_role = '' AND session_user IN ('postgres', 'supabase_admin'))
  );
BEGIN
  IF OLD.event_id IS DISTINCT FROM NEW.event_id
     OR OLD.event_guideline_version_id IS DISTINCT FROM NEW.event_guideline_version_id
     OR OLD.event_recording_session_id IS DISTINCT FROM NEW.event_recording_session_id THEN
    IF OLD.event_id IS NULL
       AND NEW.event_id IS NOT NULL
       AND OLD.event_guideline_version_id IS NOT DISTINCT FROM NEW.event_guideline_version_id
       AND OLD.event_recording_session_id IS NOT DISTINCT FROM NEW.event_recording_session_id
       AND NEW.visibility = 'private'
       AND (auth.uid() = OLD.user_id OR trusted_backend)
       AND binding_context = OLD.id::text || ':' || NEW.event_id::text THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Event pitch bindings are immutable';
  END IF;

  RETURN NEW;
END;
$trigger$;
$guard$;

-- Expand compatibility for the previous application. Its legacy route writes
-- the submission before attempting a separate pitch update, and suppresses a
-- failed update. Bind an unbound legacy pitch inside the submission statement
-- so that route cannot return success with an inconsistent public pitch.
EXECUTE $legacy_compatibility$
CREATE OR REPLACE FUNCTION public.bind_legacy_submission_pitch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $trigger$
DECLARE
  caller_id uuid := auth.uid();
  request_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
  trusted_backend boolean := (
    request_role = 'service_role'
    OR (request_role = '' AND session_user IN ('postgres', 'supabase_admin'))
  );
  event_row public.pitch_events;
  participant_row public.pitch_event_participants;
  pitch_row public.pitches;
BEGIN
  SELECT event.* INTO event_row
  FROM public.pitch_events AS event
  WHERE event.id = NEW.event_id
  FOR SHARE;

  -- Structured submissions have their own atomic RPC and binding contract.
  IF event_row.id IS NULL OR event_row.guidance_mode <> 'legacy_open' THEN
    RETURN NEW;
  END IF;
  IF NOT trusted_backend AND (caller_id IS NULL OR caller_id <> NEW.user_id) THEN
    RAISE EXCEPTION 'Submission owner must match the authenticated caller';
  END IF;
  IF NOT trusted_backend AND (
     event_row.status = 'locked'
     OR (event_row.submission_deadline IS NOT NULL AND event_row.submission_deadline < now())
  ) THEN
    RAISE EXCEPTION 'Event submissions are closed';
  END IF;

  IF NOT trusted_backend THEN
    SELECT participant.* INTO participant_row
    FROM public.pitch_event_participants AS participant
    WHERE participant.event_id = event_row.id
      AND participant.user_id = caller_id
      AND participant.status = 'active'
    FOR UPDATE;

    IF participant_row.id IS NULL THEN
      RAISE EXCEPTION 'Active event participation required';
    END IF;
  END IF;

  SELECT pitch.* INTO pitch_row
  FROM public.pitches AS pitch
  WHERE pitch.id = NEW.pitch_id
    AND pitch.user_id = NEW.user_id
    AND pitch.deleted_at IS NULL
  FOR UPDATE;

  IF pitch_row.id IS NULL THEN
    RAISE EXCEPTION 'Pitch not found or not owned by caller';
  END IF;
  IF pitch_row.event_id IS NOT NULL AND pitch_row.event_id <> event_row.id THEN
    RAISE EXCEPTION 'Pitch is already bound to another event';
  END IF;

  IF pitch_row.event_id IS NULL THEN
    PERFORM pg_catalog.set_config(
      'app.atomic_event_pitch_binding',
      pitch_row.id::text || ':' || event_row.id::text,
      true
    );

    UPDATE public.pitches
    SET event_id = event_row.id,
        visibility = 'private',
        updated_at = now()
    WHERE id = pitch_row.id;

    PERFORM pg_catalog.set_config('app.atomic_event_pitch_binding', '', true);
    PERFORM public.reconcile_pitch_review_assignments(pitch_row.id);
  END IF;

  RETURN NEW;
END;
$trigger$;
$legacy_compatibility$;

EXECUTE 'DROP TRIGGER IF EXISTS bind_legacy_submission_pitch_before_write ON public.pitch_event_submissions';
EXECUTE $legacy_trigger$
CREATE TRIGGER bind_legacy_submission_pitch_before_write
  BEFORE INSERT OR UPDATE OF event_id, pitch_id, user_id
  ON public.pitch_event_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.bind_legacy_submission_pitch()
$legacy_trigger$;

-- The older standalone binding RPC cannot make submission atomic. Remove its
-- callable surface so all new legacy-event bindings go through the contract
-- below.
EXECUTE 'DROP FUNCTION IF EXISTS public.bind_pitch_to_event_locked(uuid, uuid)';

EXECUTE $definition$
CREATE OR REPLACE FUNCTION public.submit_legacy_event_final_take_atomic(
  target_event_id uuid,
  target_pitch_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  event_row public.pitch_events;
  participant_row public.pitch_event_participants;
  pitch_row public.pitches;
  saved_submission public.pitch_event_submissions;
  visibility_changed boolean := false;
  invalidated_count integer := 0;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT event.* INTO event_row
  FROM public.pitch_events AS event
  WHERE event.id = target_event_id
  FOR SHARE;

  IF event_row.id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;
  IF event_row.guidance_mode <> 'legacy_open' THEN
    RAISE EXCEPTION 'Structured event submissions require the structured workflow';
  END IF;
  IF event_row.status = 'locked'
     OR (event_row.submission_deadline IS NOT NULL AND event_row.submission_deadline < now()) THEN
    RAISE EXCEPTION 'Event submissions are closed';
  END IF;

  SELECT participant.* INTO participant_row
  FROM public.pitch_event_participants AS participant
  WHERE participant.event_id = event_row.id
    AND participant.user_id = caller_id
    AND participant.status = 'active'
  FOR UPDATE;

  IF participant_row.id IS NULL THEN
    RAISE EXCEPTION 'Active event participation required';
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
  IF pitch_row.event_id IS NOT NULL AND pitch_row.event_id <> event_row.id THEN
    RAISE EXCEPTION 'Pitch is already bound to another event';
  END IF;

  visibility_changed := pitch_row.visibility = 'public';
  IF pitch_row.event_id IS NULL OR pitch_row.visibility <> 'private' THEN
    PERFORM pg_catalog.set_config(
      'app.atomic_event_pitch_binding',
      pitch_row.id::text || ':' || event_row.id::text,
      true
    );

    UPDATE public.pitches
    SET event_id = event_row.id,
        visibility = 'private',
        updated_at = now()
    WHERE id = pitch_row.id
    RETURNING * INTO pitch_row;

    PERFORM pg_catalog.set_config('app.atomic_event_pitch_binding', '', true);

    invalidated_count := public.reconcile_pitch_review_assignments(pitch_row.id);
  END IF;

  INSERT INTO public.pitch_event_submissions (
    event_id,
    user_id,
    pitch_id,
    status,
    submitted_at,
    updated_at
  ) VALUES (
    event_row.id,
    caller_id,
    pitch_row.id,
    'submitted',
    now(),
    now()
  )
  ON CONFLICT (event_id, user_id) DO UPDATE
  SET pitch_id = EXCLUDED.pitch_id,
      status = 'submitted',
      submitted_at = now(),
      updated_at = now()
  RETURNING * INTO saved_submission;

  RETURN jsonb_build_object(
    'submission', to_jsonb(saved_submission),
    'pitch_id', pitch_row.id,
    'public_id', pitch_row.public_id,
    'visibility_changed', visibility_changed,
    'invalidated_assignments', invalidated_count
  );
END;
$function$;
$definition$;

EXECUTE 'REVOKE ALL ON FUNCTION public.submit_legacy_event_final_take_atomic(uuid, uuid) FROM PUBLIC, anon, authenticated';
EXECUTE 'GRANT EXECUTE ON FUNCTION public.submit_legacy_event_final_take_atomic(uuid, uuid) TO authenticated';
EXECUTE 'REVOKE ALL ON FUNCTION public.prevent_pitch_binding_mutation() FROM PUBLIC, anon, authenticated';
EXECUTE 'REVOKE ALL ON FUNCTION public.bind_legacy_submission_pitch() FROM PUBLIC, anon, authenticated';

EXECUTE $comment$
COMMENT ON FUNCTION public.submit_legacy_event_final_take_atomic(uuid, uuid) IS
  'Atomically binds an owned legacy-event final take as private, reconciles stale assignments, and upserts its submission.'
$comment$;
END;
$migration$;
