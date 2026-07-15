-- Migration 020: Add nudge audit dedupe support
-- Supports production-safe daily founder prompts and event deadline reminders.

ALTER TABLE nudge_events
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES pitch_events(id) ON DELETE SET NULL;

ALTER TABLE nudge_events
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nudge_events_dedupe_key
  ON nudge_events(dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nudge_events_event_id
  ON nudge_events(event_id);

COMMENT ON COLUMN nudge_events.event_id IS
  'Event context for automated deadline reminder nudges.';

COMMENT ON COLUMN nudge_events.dedupe_key IS
  'Unique key used to prevent duplicate automated nudge sends.';
