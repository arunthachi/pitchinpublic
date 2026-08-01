-- Add enforceable expiry to event-scoped founder and team invitations.

ALTER TABLE public.pitch_event_invitations
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE public.pitch_event_invitations
SET expires_at = COALESCE(created_at, now()) + interval '30 days'
WHERE expires_at IS NULL;

ALTER TABLE public.pitch_event_invitations
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days'),
  ALTER COLUMN expires_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pitch_event_invitations_status_expires_at
  ON public.pitch_event_invitations (status, expires_at);

COMMENT ON COLUMN public.pitch_event_invitations.expires_at IS
  'Event invitation expiry enforced by the join endpoint; resending an expired pending invite extends it by 30 days.';
