-- Review follow-up: close direct-RPC authorization gaps, preserve invalidated
-- assignment history without blocking replacements, and align batch limits.

-- submit_pitch_feedback is the ordinary public-feed entry point. Event and
-- other private scopes use their dedicated RPCs. Keep this as a checked patch
-- so a future upstream body change fails migration rather than silently
-- restoring access by stale private UUID.
DO $migration$
DECLARE
  function_definition text;
  patched_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.submit_pitch_feedback(uuid,text,text,uuid)'::regprocedure
  ) INTO function_definition;

  patched_definition := replace(
    function_definition,
    E'    AND pitch.status = \'published\'\n    AND pitch.deleted_at IS NULL\n  FOR SHARE;',
    E'    AND pitch.status = \'published\'\n    AND pitch.deleted_at IS NULL\n    AND pitch.visibility = \'public\'\n    AND public.can_view_pitch(pitch.id)\n  FOR SHARE;'
  );

  IF patched_definition = function_definition THEN
    RAISE EXCEPTION 'Could not harden submit_pitch_feedback pitch scope';
  END IF;

  EXECUTE patched_definition;
END;
$migration$;

REVOKE ALL ON FUNCTION public.submit_pitch_feedback(uuid, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_pitch_feedback(uuid, text, text, uuid)
  TO authenticated;

COMMENT ON FUNCTION public.submit_pitch_feedback(uuid, text, text, uuid) IS
  'Submits ordinary feedback only for an active caller-visible public pitch and completes only a global assignment.';

-- Historical invalidated assignments remain auditable, but only non-invalidated
-- assignments suppress a replacement claim. The partial unique indexes enforce
-- the same active-row definition during concurrent claims.
DO $migration$
DECLARE
  signature regprocedure;
  function_definition text;
  patched_definition text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.claim_global_review_assignments(integer,timestamp with time zone)'::regprocedure,
    'public.claim_trusted_review_assignments(integer,timestamp with time zone)'::regprocedure
  ] LOOP
    SELECT pg_get_functiondef(signature) INTO function_definition;
    patched_definition := replace(
      function_definition,
      E'          AND existing.reviewer_user_id = auth.uid()\n      )',
      E'          AND existing.reviewer_user_id = auth.uid()\n          AND existing.status <> \'invalidated\'\n      )'
    );

    IF patched_definition = function_definition THEN
      RAISE EXCEPTION 'Could not align invalidated assignment eligibility in %', signature;
    END IF;

    EXECUTE patched_definition;
  END LOOP;
END;
$migration$;

REVOKE ALL ON FUNCTION public.claim_global_review_assignments(
  integer, timestamp with time zone
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_global_review_assignments(
  integer, timestamp with time zone
) TO authenticated;

REVOKE ALL ON FUNCTION public.claim_trusted_review_assignments(
  integer, timestamp with time zone
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_trusted_review_assignments(
  integer, timestamp with time zone
) TO authenticated;

-- Callers already batch up to 100 pitch IDs. Keep the projection contract at
-- that bounded maximum. A role-only disclosure includes a generic role label,
-- never trusted-reviewer title, organization, or expertise badge data.
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
  IF target_pitch_ids IS NULL OR cardinality(target_pitch_ids) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'target_pitch_ids must contain between 1 and 100 pitches';
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
      WHEN membership.id IS NOT NULL
        AND (authorized.has_accountability_access OR feedback.disclosure_mode = 'named')
        THEN jsonb_build_object(
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

REVOKE ALL ON FUNCTION public.get_founder_pitch_feedback(uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_founder_pitch_feedback(uuid[])
  TO anon, authenticated;
