-- Contract the temporary PR1 compatibility grants after the compatible
-- application has been verified in production.

DO $migration$
DECLARE
  required_signature text;
  required_signatures constant text[] := ARRAY[
    'public.get_founder_pitch_feedback(uuid[])',
    'public.get_my_feedback_history(integer,timestamp with time zone,uuid)',
    'public.can_rate_feedback(uuid)',
    'public.get_review_queue_snapshot(integer,text)',
    'public.get_review_assignment_detail(uuid)',
    'public.get_event_review_assignments(uuid)'
  ];
BEGIN
  FOREACH required_signature IN ARRAY required_signatures LOOP
    IF to_regprocedure(required_signature) IS NULL THEN
      RAISE EXCEPTION
        'Cannot contract incident identity access: required safe RPC % is missing',
        required_signature;
    END IF;
  END LOOP;
END;
$migration$;

-- REVOKE SELECT alone does not remove legacy column-level grants. Clear every
-- browser-role ACL first, then rebuild the exact read-only allowlist below.
REVOKE ALL ON public.feedback FROM anon, authenticated;

GRANT SELECT (
  id,
  pitch_id,
  type,
  content,
  is_public,
  created_at,
  updated_at,
  event_guideline_version_id,
  criterion_key,
  observation,
  next_step
) ON public.feedback TO anon, authenticated;

-- Reviewer identity remains available to service-side audit workflows and to
-- caller-safe projections whose SECURITY DEFINER bodies enforce disclosure.
GRANT ALL ON public.feedback TO service_role;

COMMENT ON COLUMN public.feedback.user_id IS
  'Accountable reviewer identity. Browser roles must access it only through disclosure-aware RPC projections.';

-- RLS remains enabled as defense in depth, but browser roles no longer receive
-- table privileges that could expose reviewer_user_id through organizer rows.
REVOKE ALL ON public.review_assignments FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.review_assignments TO service_role;

COMMENT ON COLUMN public.review_assignments.reviewer_user_id IS
  'Accountable reviewer identity. Browser roles must use caller-safe queue/detail or event accountability RPCs.';

COMMENT ON TABLE public.review_assignments IS
  'Review assignment audit ledger. Direct access is service-role only; browser access is through fixed RPC projections.';
