-- Migration 015: Event announcement email delivery status
-- Adds persisted status for founder announcement email delivery.

ALTER TABLE public.pitch_event_announcements
  ADD COLUMN IF NOT EXISTS email_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS email_error text,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pitch_event_announcements_email_status_check'
  ) THEN
    ALTER TABLE public.pitch_event_announcements
      DROP CONSTRAINT pitch_event_announcements_email_status_check;
  END IF;
END $$;

ALTER TABLE public.pitch_event_announcements
  ADD CONSTRAINT pitch_event_announcements_email_status_check
  CHECK (email_status IN ('unknown', 'skipped', 'sent', 'failed', 'not_configured'));

DROP POLICY IF EXISTS "Event team can create announcements" ON pitch_event_announcements;
CREATE POLICY "Organizers and admins can create announcements"
  ON pitch_event_announcements FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM pitch_events
        WHERE pitch_events.id = pitch_event_announcements.event_id
          AND pitch_events.organizer_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM pitch_event_participants
        WHERE pitch_event_participants.event_id = pitch_event_announcements.event_id
          AND pitch_event_participants.user_id = auth.uid()
          AND pitch_event_participants.role IN ('organizer', 'admin')
          AND pitch_event_participants.status = 'active'
      )
    )
  );

COMMENT ON COLUMN public.pitch_event_announcements.email_status IS
  'Founder announcement email delivery state: unknown, skipped, sent, failed, or not_configured.';

COMMENT ON COLUMN public.pitch_event_announcements.email_error IS
  'Last delivery error returned by Resend, if any.';

COMMENT ON COLUMN public.pitch_event_announcements.email_sent_at IS
  'Timestamp when the founder announcement email was accepted by the provider.';
