-- Migration 019: Event invite email delivery status
-- Tracks invite email delivery on event-scoped founder/team invitations.

ALTER TABLE public.pitch_event_invitations
  ADD COLUMN IF NOT EXISTS email_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS email_error text,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pitch_event_invitations_email_status_check'
  ) THEN
    ALTER TABLE public.pitch_event_invitations
      DROP CONSTRAINT pitch_event_invitations_email_status_check;
  END IF;
END $$;

ALTER TABLE public.pitch_event_invitations
  ADD CONSTRAINT pitch_event_invitations_email_status_check
  CHECK (email_status IN ('unknown', 'skipped', 'sent', 'failed', 'not_configured'));

COMMENT ON COLUMN public.pitch_event_invitations.email_status IS
  'Delivery state for the invite email: unknown, skipped, sent, failed, or not_configured.';

COMMENT ON COLUMN public.pitch_event_invitations.email_error IS
  'Last email provider error for debugging invite delivery.';

COMMENT ON COLUMN public.pitch_event_invitations.email_sent_at IS
  'Timestamp when the invite email provider accepted the message.';
