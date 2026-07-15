-- Migration 019: Extend lead requests into a lightweight application workflow
-- Adds a request status plus requester confirmation delivery tracking.

ALTER TABLE lead_requests
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS confirmation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS confirmation_error text,
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lead_requests_status_check'
  ) THEN
    ALTER TABLE lead_requests
      ADD CONSTRAINT lead_requests_status_check
      CHECK (status IN ('new', 'reviewing', 'approved', 'declined'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lead_requests_confirmation_status_check'
  ) THEN
    ALTER TABLE lead_requests
      ADD CONSTRAINT lead_requests_confirmation_status_check
      CHECK (confirmation_status IN ('pending', 'sent', 'failed', 'not_configured', 'skipped'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lead_requests_status ON lead_requests(status);
CREATE INDEX IF NOT EXISTS idx_lead_requests_confirmation_status ON lead_requests(confirmation_status);
CREATE INDEX IF NOT EXISTS idx_lead_requests_source ON lead_requests(source);

COMMENT ON COLUMN public.lead_requests.status IS
  'Application state for founder and organizer requests: new, reviewing, approved, or declined.';

COMMENT ON COLUMN public.lead_requests.confirmation_status IS
  'Delivery state for the requester confirmation/onboarding email.';

COMMENT ON COLUMN public.lead_requests.confirmation_error IS
  'Latest requester confirmation delivery error, if any.';

COMMENT ON COLUMN public.lead_requests.confirmation_sent_at IS
  'Timestamp when the requester confirmation email was accepted by the provider.';

COMMENT ON COLUMN public.lead_requests.notification_sent_at IS
  'Timestamp when the internal lead notification email was accepted by the provider.';
