-- Migration 016: Extend event pitch length
-- Organizer pitch rooms can require longer competition pitches up to 6 minutes.

ALTER TABLE pitch_events
  DROP CONSTRAINT IF EXISTS pitch_events_pitch_length_seconds_check;

ALTER TABLE pitch_events
  ADD CONSTRAINT pitch_events_pitch_length_seconds_check
  CHECK (pitch_length_seconds BETWEEN 30 AND 360);
