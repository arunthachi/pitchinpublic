-- Migration 007: Event pilot workflow
-- Adds pitch sprint events, participants, and final-take submissions.

CREATE TABLE IF NOT EXISTS pitch_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  event_date DATE NOT NULL,
  submission_deadline TIMESTAMP WITH TIME ZONE,
  pitch_length_seconds INTEGER NOT NULL DEFAULT 60 CHECK (pitch_length_seconds BETWEEN 30 AND 180),
  focus TEXT NOT NULL DEFAULT 'clarity',
  visibility TEXT NOT NULL DEFAULT 'unlisted' CHECK (visibility IN ('private', 'unlisted', 'public')),
  access_code TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'locked', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pitch_events_organizer_id ON pitch_events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_pitch_events_slug ON pitch_events(slug);
CREATE INDEX IF NOT EXISTS idx_pitch_events_event_date ON pitch_events(event_date);
CREATE INDEX IF NOT EXISTS idx_pitch_events_status ON pitch_events(status);

ALTER TABLE pitch_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can create pitch events" ON pitch_events;
CREATE POLICY "Authenticated users can create pitch events"
  ON pitch_events FOR INSERT
  WITH CHECK (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "Organizers can update their pitch events" ON pitch_events;
CREATE POLICY "Organizers can update their pitch events"
  ON pitch_events FOR UPDATE
  USING (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "Organizers can delete their pitch events" ON pitch_events;
CREATE POLICY "Organizers can delete their pitch events"
  ON pitch_events FOR DELETE
  USING (auth.uid() = organizer_id);

CREATE TABLE IF NOT EXISTS pitch_event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES pitch_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'founder' CHECK (role IN ('founder', 'organizer', 'judge')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'removed')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pitch_event_participants_event_id ON pitch_event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_pitch_event_participants_user_id ON pitch_event_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_pitch_event_participants_role ON pitch_event_participants(role);

ALTER TABLE pitch_event_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pitch events are visible to public or related users" ON pitch_events;
CREATE POLICY "Pitch events are visible to public or related users"
  ON pitch_events FOR SELECT
  USING (
    visibility IN ('public', 'unlisted')
    OR organizer_id = auth.uid()
  );

DROP POLICY IF EXISTS "Participants are visible to event members" ON pitch_event_participants;
CREATE POLICY "Participants are visible to event members"
  ON pitch_event_participants FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM pitch_events
      WHERE pitch_events.id = pitch_event_participants.event_id
        AND pitch_events.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can join pitch events" ON pitch_event_participants;
CREATE POLICY "Users can join pitch events"
  ON pitch_event_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Participants and organizers can update participants" ON pitch_event_participants;
CREATE POLICY "Participants and organizers can update participants"
  ON pitch_event_participants FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM pitch_events
      WHERE pitch_events.id = pitch_event_participants.event_id
        AND pitch_events.organizer_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS pitch_event_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES pitch_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'locked')),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pitch_event_submissions_event_id ON pitch_event_submissions(event_id);
CREATE INDEX IF NOT EXISTS idx_pitch_event_submissions_user_id ON pitch_event_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_pitch_event_submissions_pitch_id ON pitch_event_submissions(pitch_id);

ALTER TABLE pitch_event_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Submissions are visible to owner and organizers" ON pitch_event_submissions;
CREATE POLICY "Submissions are visible to owner and organizers"
  ON pitch_event_submissions FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM pitch_events
      WHERE pitch_events.id = pitch_event_submissions.event_id
        AND pitch_events.organizer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM pitch_event_participants
      WHERE pitch_event_participants.event_id = pitch_event_submissions.event_id
        AND pitch_event_participants.user_id = auth.uid()
        AND pitch_event_participants.role = 'judge'
        AND pitch_event_participants.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Founders can submit their own final take" ON pitch_event_submissions;
CREATE POLICY "Founders can submit their own final take"
  ON pitch_event_submissions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM pitches
      WHERE pitches.id = pitch_event_submissions.pitch_id
        AND pitches.user_id = auth.uid()
        AND pitches.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Founders can update their own final take" ON pitch_event_submissions;
CREATE POLICY "Founders can update their own final take"
  ON pitch_event_submissions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM pitches
      WHERE pitches.id = pitch_event_submissions.pitch_id
        AND pitches.user_id = auth.uid()
        AND pitches.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Founders can delete their own final take" ON pitch_event_submissions;
CREATE POLICY "Founders can delete their own final take"
  ON pitch_event_submissions FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE pitch_events IS 'Pitch sprint events for cohort, competition, and demo-day pilots.';
COMMENT ON TABLE pitch_event_participants IS 'Founders, organizers, and judges attached to pitch sprint events.';
COMMENT ON TABLE pitch_event_submissions IS 'One final take per founder per event.';
