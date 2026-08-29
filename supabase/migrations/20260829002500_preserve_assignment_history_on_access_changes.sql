-- Preserve review-assignment history whenever reviewer or event access changes.
-- Every RPC locks affected pitches before active assignment rows, invalidates
-- those rows in place, and commits the access mutation in the same transaction.

CREATE OR REPLACE FUNCTION public.is_pip_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins AS admin
    JOIN auth.users AS account ON lower(account.email) = lower(admin.email)
    WHERE account.id = auth.uid()
      AND admin.role = 'super_admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_pip_super_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_pip_super_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_pilot_user_id(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
  SELECT target_user_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.trusted_reviewer_memberships AS membership
      WHERE membership.user_id = target_user_id
        AND membership.status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM public.pilot_members AS pilot
      WHERE pilot.user_id = target_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.platform_admins AS admin
      JOIN auth.users AS account ON lower(account.email) = lower(admin.email)
      WHERE account.id = target_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.organizer_invitations AS invitation
      JOIN auth.users AS account ON lower(account.email) = lower(invitation.email)
      WHERE account.id = target_user_id
        AND invitation.status IN ('pending', 'accepted')
        AND (invitation.expires_at IS NULL OR invitation.expires_at >= now())
    )
    OR EXISTS (
      SELECT 1
      FROM public.pitch_event_invitations AS invitation
      JOIN auth.users AS account ON lower(account.email) = lower(invitation.email)
      WHERE account.id = target_user_id
        AND invitation.status IN ('pending', 'accepted')
    )
  );
$$;

REVOKE ALL ON FUNCTION public.is_pilot_user_id(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_review_assignment_eligible_for(
  target_assignment_id uuid,
  target_reviewer_id uuid
)
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
      AND assignment.reviewer_user_id = target_reviewer_id
      AND assignment.status IN ('pending', 'started')
      AND pitch.user_id <> target_reviewer_id
      AND pitch.status = 'published'
      AND pitch.deleted_at IS NULL
      AND public.is_pilot_user_id(target_reviewer_id)
      AND (
        (
          assignment.event_id IS NULL
          AND pitch.visibility = 'public'
          AND (
            assignment.reviewer_role <> 'trusted_reviewer'
            OR EXISTS (
              SELECT 1 FROM public.trusted_reviewer_memberships AS membership
              WHERE membership.user_id = target_reviewer_id
                AND membership.status = 'active'
            )
          )
        )
        OR (
          assignment.event_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.pitch_event_submissions AS submission
            WHERE submission.event_id = assignment.event_id
              AND submission.pitch_id = assignment.pitch_id
              AND submission.status IN ('submitted', 'locked')
          )
          AND (
            EXISTS (
              SELECT 1 FROM public.pitch_event_participants AS participant
              WHERE participant.event_id = assignment.event_id
                AND participant.user_id = target_reviewer_id
                AND participant.status = 'active'
            )
            OR (
              assignment.reviewer_role = 'trusted_reviewer'
              AND EXISTS (
                SELECT 1
                FROM public.trusted_reviewer_memberships AS membership
                JOIN public.trusted_reviewer_event_access AS event_access
                  ON event_access.membership_id = membership.id
                 AND event_access.event_id = assignment.event_id
                WHERE membership.user_id = target_reviewer_id
                  AND membership.status = 'active'
              )
            )
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_review_assignment_eligible_for(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_review_assignment_eligible(target_assignment_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.is_review_assignment_eligible_for(target_assignment_id, auth.uid());
$$;

REVOKE ALL ON FUNCTION public.is_review_assignment_eligible(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_review_assignment_eligible(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_trusted_reviewer_event_access_locked(
  target_membership_id uuid,
  target_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  membership_row public.trusted_reviewer_memberships;
  invalidated_count integer;
BEGIN
  IF NOT public.is_pip_super_admin() THEN
    RAISE EXCEPTION 'Platform super admin access required';
  END IF;

  SELECT membership.* INTO membership_row
  FROM public.trusted_reviewer_memberships AS membership
  WHERE membership.id = target_membership_id
    AND membership.status = 'active'
  FOR UPDATE;

  IF membership_row.id IS NULL THEN
    RAISE EXCEPTION 'Active reviewer membership not found';
  END IF;

  PERFORM pitch.id
  FROM public.pitches AS pitch
  JOIN public.review_assignments AS assignment ON assignment.pitch_id = pitch.id
  WHERE assignment.reviewer_user_id = membership_row.user_id
    AND assignment.event_id = target_event_id
    AND assignment.status IN ('pending', 'started')
  ORDER BY pitch.id
  FOR UPDATE OF pitch;

  PERFORM assignment.id
  FROM public.review_assignments AS assignment
  WHERE assignment.reviewer_user_id = membership_row.user_id
    AND assignment.event_id = target_event_id
    AND assignment.status IN ('pending', 'started')
  ORDER BY assignment.id
  FOR UPDATE;

  DELETE FROM public.trusted_reviewer_event_access
  WHERE membership_id = membership_row.id
    AND event_id = target_event_id;

  UPDATE public.review_assignments AS assignment
  SET status = 'invalidated',
      invalidated_at = now(),
      invalidation_reason = 'trusted_event_access_revoked'
  WHERE assignment.reviewer_user_id = membership_row.user_id
    AND assignment.event_id = target_event_id
    AND assignment.status IN ('pending', 'started')
    AND NOT public.is_review_assignment_eligible_for(assignment.id, membership_row.user_id);
  GET DIAGNOSTICS invalidated_count = ROW_COUNT;

  RETURN jsonb_build_object('revoked', true, 'invalidated_assignments', invalidated_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_trusted_reviewer_membership_locked(
  target_membership_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  membership_row public.trusted_reviewer_memberships;
  invalidated_count integer;
BEGIN
  IF NOT public.is_pip_super_admin() THEN
    RAISE EXCEPTION 'Platform super admin access required';
  END IF;

  SELECT membership.* INTO membership_row
  FROM public.trusted_reviewer_memberships AS membership
  WHERE membership.id = target_membership_id
    AND membership.status = 'active'
  FOR UPDATE;

  IF membership_row.id IS NULL THEN
    RAISE EXCEPTION 'Active reviewer membership not found';
  END IF;

  PERFORM pitch.id
  FROM public.pitches AS pitch
  JOIN public.review_assignments AS assignment ON assignment.pitch_id = pitch.id
  WHERE assignment.reviewer_user_id = membership_row.user_id
    AND assignment.status IN ('pending', 'started')
  ORDER BY pitch.id
  FOR UPDATE OF pitch;

  PERFORM assignment.id
  FROM public.review_assignments AS assignment
  WHERE assignment.reviewer_user_id = membership_row.user_id
    AND assignment.status IN ('pending', 'started')
  ORDER BY assignment.id
  FOR UPDATE;

  UPDATE public.trusted_reviewer_memberships
  SET status = 'revoked',
      revoked_at = now(),
      revoked_by = auth.uid()
  WHERE id = membership_row.id;

  DELETE FROM public.trusted_reviewer_event_access
  WHERE membership_id = membership_row.id;

  -- Event participation remains a valid access path after trusted membership
  -- ends. Reclassify those locked assignments so the founder queue can surface
  -- them; leaving reviewer_role=trusted_reviewer would strand valid work.
  UPDATE public.review_assignments AS assignment
  SET reviewer_role = CASE participant.role
        WHEN 'founder' THEN 'peer_founder'
        WHEN 'admin' THEN 'organizer'
        ELSE participant.role
      END
  FROM public.pitch_event_participants AS participant
  WHERE assignment.reviewer_user_id = membership_row.user_id
    AND assignment.status IN ('pending', 'started')
    AND assignment.reviewer_role = 'trusted_reviewer'
    AND assignment.event_id = participant.event_id
    AND participant.user_id = membership_row.user_id
    AND participant.status = 'active';

  UPDATE public.review_assignments AS assignment
  SET status = 'invalidated',
      invalidated_at = now(),
      invalidation_reason = 'trusted_membership_revoked'
  WHERE assignment.reviewer_user_id = membership_row.user_id
    AND assignment.status IN ('pending', 'started')
    AND NOT public.is_review_assignment_eligible_for(assignment.id, membership_row.user_id);
  GET DIAGNOSTICS invalidated_count = ROW_COUNT;

  RETURN jsonb_build_object('revoked', true, 'invalidated_assignments', invalidated_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_event_participant_locked(
  target_event_id uuid,
  target_participant_id uuid,
  target_role text DEFAULT NULL,
  target_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  caller_id uuid := auth.uid();
  event_row public.pitch_events;
  participant_row public.pitch_event_participants;
  previous_role text;
  next_role text;
  next_status text;
  invalidated_count integer := 0;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF target_role IS NULL AND target_status IS NULL THEN
    RAISE EXCEPTION 'Choose a role or status change';
  END IF;

  SELECT event.* INTO event_row
  FROM public.pitch_events AS event
  WHERE event.id = target_event_id
  FOR UPDATE;

  IF event_row.id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;
  IF event_row.organizer_id <> caller_id AND NOT EXISTS (
    SELECT 1 FROM public.pitch_event_participants AS manager
    WHERE manager.event_id = event_row.id
      AND manager.user_id = caller_id
      AND manager.status = 'active'
      AND manager.role IN ('organizer', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only event organizers and admins can manage participants';
  END IF;

  SELECT participant.* INTO participant_row
  FROM public.pitch_event_participants AS participant
  WHERE participant.id = target_participant_id
    AND participant.event_id = event_row.id
  FOR UPDATE;

  IF participant_row.id IS NULL THEN
    RAISE EXCEPTION 'Participant not found';
  END IF;
  IF participant_row.user_id = event_row.organizer_id THEN
    RAISE EXCEPTION 'The event organizer account cannot be changed here';
  END IF;

  next_role := coalesce(target_role, participant_row.role);
  next_status := coalesce(target_status, participant_row.status);
  previous_role := participant_row.role;
  IF next_role NOT IN ('founder', 'organizer', 'admin', 'coach', 'mentor', 'judge')
     OR next_status NOT IN ('active', 'removed') THEN
    RAISE EXCEPTION 'Invalid participant role or status';
  END IF;
  IF participant_row.role = 'founder' AND next_role <> 'founder' THEN
    RAISE EXCEPTION 'Founder participants can only be removed or restored';
  END IF;
  IF participant_row.role <> 'founder' AND next_role = 'founder' THEN
    RAISE EXCEPTION 'Team members cannot be converted into founders';
  END IF;

  IF next_role IS DISTINCT FROM participant_row.role
     OR next_status IS DISTINCT FROM participant_row.status THEN
    PERFORM pitch.id
    FROM public.pitches AS pitch
    JOIN public.review_assignments AS assignment ON assignment.pitch_id = pitch.id
    WHERE assignment.event_id = event_row.id
      AND assignment.reviewer_user_id = participant_row.user_id
      AND assignment.status IN ('pending', 'started')
    ORDER BY pitch.id
    FOR UPDATE OF pitch;

    PERFORM assignment.id
    FROM public.review_assignments AS assignment
    WHERE assignment.event_id = event_row.id
      AND assignment.reviewer_user_id = participant_row.user_id
      AND assignment.status IN ('pending', 'started')
    ORDER BY assignment.id
    FOR UPDATE;

    UPDATE public.pitch_event_participants
    SET role = next_role,
        status = next_status
    WHERE id = participant_row.id
    RETURNING * INTO participant_row;

    IF next_status = 'active' AND next_role IS DISTINCT FROM previous_role THEN
      UPDATE public.review_assignments
      SET reviewer_role = CASE next_role
            WHEN 'founder' THEN 'peer_founder'
            WHEN 'admin' THEN 'organizer'
            ELSE next_role
          END
      WHERE event_id = event_row.id
        AND reviewer_user_id = participant_row.user_id
        AND status IN ('pending', 'started');
    END IF;

    UPDATE public.review_assignments AS assignment
    SET status = 'invalidated',
        invalidated_at = now(),
        invalidation_reason = 'participant_access_changed'
    WHERE assignment.event_id = event_row.id
      AND assignment.reviewer_user_id = participant_row.user_id
      AND assignment.status IN ('pending', 'started')
      AND NOT public.is_review_assignment_eligible_for(assignment.id, participant_row.user_id);
    GET DIAGNOSTICS invalidated_count = ROW_COUNT;
  END IF;

  RETURN to_jsonb(participant_row) || jsonb_build_object(
    'invalidated_assignments', invalidated_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_my_event_submission_locked(target_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  caller_id uuid := auth.uid();
  event_row public.pitch_events;
  submission_row public.pitch_event_submissions;
  pitch_row public.pitches;
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
  IF event_row.status = 'locked' THEN
    RAISE EXCEPTION 'Submissions are locked for this event';
  END IF;
  IF event_row.submission_deadline IS NOT NULL
     AND event_row.submission_deadline < now() THEN
    RAISE EXCEPTION 'The submission deadline has passed for this event';
  END IF;

  SELECT submission.* INTO submission_row
  FROM public.pitch_event_submissions AS submission
  WHERE submission.event_id = event_row.id
    AND submission.user_id = caller_id;

  IF submission_row.id IS NULL THEN
    RETURN jsonb_build_object('deleted', false, 'reason', 'not_found');
  END IF;

  SELECT pitch.* INTO pitch_row
  FROM public.pitches AS pitch
  WHERE pitch.id = submission_row.pitch_id
    AND pitch.user_id = caller_id
  FOR UPDATE;

  IF pitch_row.id IS NULL THEN
    RAISE EXCEPTION 'Submission pitch is unavailable';
  END IF;

  PERFORM assignment.id
  FROM public.review_assignments AS assignment
  WHERE assignment.event_id = event_row.id
    AND assignment.pitch_id = pitch_row.id
    AND assignment.status IN ('pending', 'started')
  ORDER BY assignment.id
  FOR UPDATE;

  SELECT submission.* INTO submission_row
  FROM public.pitch_event_submissions AS submission
  WHERE submission.id = submission_row.id
  FOR UPDATE;

  IF submission_row.id IS NULL THEN
    RETURN jsonb_build_object('deleted', false, 'reason', 'not_found');
  END IF;

  DELETE FROM public.pitch_event_submissions
  WHERE id = submission_row.id;

  UPDATE public.review_assignments AS assignment
  SET status = 'invalidated',
      invalidated_at = now(),
      invalidation_reason = 'event_submission_removed'
  WHERE assignment.event_id = event_row.id
    AND assignment.pitch_id = pitch_row.id
    AND assignment.status IN ('pending', 'started')
    AND NOT public.is_review_assignment_eligible_for(assignment.id, assignment.reviewer_user_id);
  GET DIAGNOSTICS invalidated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted', true,
    'pitch_id', pitch_row.id,
    'invalidated_assignments', invalidated_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_review_assignment_detail(target_assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  caller_id uuid := auth.uid();
  target_pitch_id uuid;
  assignment_row public.review_assignments;
  result jsonb;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Discover without a row lock, then take the repository-wide pitch-before-
  -- assignment lock order. The assignment is re-read after both locks.
  SELECT assignment.pitch_id INTO target_pitch_id
  FROM public.review_assignments AS assignment
  WHERE assignment.id = target_assignment_id
    AND assignment.reviewer_user_id = caller_id;

  IF target_pitch_id IS NULL THEN
    RETURN jsonb_build_object('available', false, 'reason', 'not_found');
  END IF;

  PERFORM pitch.id
  FROM public.pitches AS pitch
  WHERE pitch.id = target_pitch_id
  FOR SHARE;

  SELECT assignment.* INTO assignment_row
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
    E'  LIMIT 1\n  FOR UPDATE;',
    E'  LIMIT 1\n  FOR UPDATE;\n\n  IF matched_assignment.id IS NOT NULL\n     AND NOT public.is_review_assignment_eligible(matched_assignment.id) THEN\n    RAISE EXCEPTION ''This event review is no longer available'';\n  END IF;'
  );

  IF patched_definition = function_definition THEN
    RAISE EXCEPTION 'Could not add post-lock event-review eligibility checks';
  END IF;

  EXECUTE patched_definition;
END;
$migration$;

REVOKE ALL ON FUNCTION public.revoke_trusted_reviewer_event_access_locked(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_trusted_reviewer_membership_locked(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_event_participant_locked(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_my_event_submission_locked(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.revoke_trusted_reviewer_event_access_locked(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_trusted_reviewer_membership_locked(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_event_participant_locked(uuid, uuid, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_event_submission_locked(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.submit_event_pitch_feedback(uuid, text, text, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_event_pitch_feedback(uuid, text, text, uuid, uuid)
  TO authenticated;
