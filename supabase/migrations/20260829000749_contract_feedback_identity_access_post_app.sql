-- Contract phase. Apply only after all application readers use
-- get_founder_pitch_feedback/get_my_feedback_history/can_rate_feedback.
-- The expand migration is independently deployable and preserves the old grant.

REVOKE SELECT ON public.feedback FROM anon, authenticated;

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
-- the caller-safe projections, whose SECURITY DEFINER bodies enforce founder,
-- reviewer, event-manager, and disclosure-mode rules.
GRANT ALL ON public.feedback TO service_role;

COMMENT ON COLUMN public.feedback.user_id IS
  'Accountable reviewer identity. Browser roles must access it only through disclosure-aware RPC projections.';
