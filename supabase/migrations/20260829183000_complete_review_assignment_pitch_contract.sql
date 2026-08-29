-- Review assignment detail is rendered by the same feed as ordinary pitches.
-- Return the complete feed contract so opening an assignment cannot produce
-- undefined engagement metrics in the client.

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
      'description', pitch.description,
      'startup_name', pitch.startup_name,
      'one_line_pitch', pitch.one_line_pitch,
      'feedback_ask', pitch.feedback_ask,
      'video_id', pitch.video_id,
      'video_url', pitch.video_url,
      'thumbnail_url', pitch.thumbnail_url,
      'duration', pitch.duration,
      'views_count', pitch.views_count,
      'interest_score', pitch.interest_score,
      'roast_count', pitch.roast_count,
      'toast_count', pitch.toast_count,
      'created_at', pitch.created_at,
      'take_version', pitch.take_version,
      'version_number', pitch.version_number,
      'is_best_take', pitch.is_best_take,
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

COMMENT ON FUNCTION public.get_review_assignment_detail(uuid) IS
  'Locks and starts one eligible caller-owned assignment and returns its complete feed pitch contract.';
