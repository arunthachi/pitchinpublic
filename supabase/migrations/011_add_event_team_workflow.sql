-- Migration 011: Event team workflow
-- Adds admin/coach/mentor team roles, invitations, and event announcements.

ALTER TABLE pitch_event_participants
  DROP CONSTRAINT IF EXISTS pitch_event_participants_role_check;

ALTER TABLE pitch_event_participants
  ADD CONSTRAINT pitch_event_participants_role_check
  CHECK (role IN ('founder', 'organizer', 'admin', 'coach', 'mentor', 'judge'));

CREATE TABLE IF NOT EXISTS pitch_event_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES pitch_events(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'founder' CHECK (role IN ('founder', 'organizer', 'admin', 'coach', 'mentor', 'judge')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  invite_code TEXT NOT NULL,
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  accepted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, invite_code)
);

CREATE INDEX IF NOT EXISTS idx_pitch_event_invitations_event_id ON pitch_event_invitations(event_id);
CREATE INDEX IF NOT EXISTS idx_pitch_event_invitations_email ON pitch_event_invitations(email);
CREATE INDEX IF NOT EXISTS idx_pitch_event_invitations_invite_code ON pitch_event_invitations(invite_code);
CREATE INDEX IF NOT EXISTS idx_pitch_event_invitations_role ON pitch_event_invitations(role);

ALTER TABLE pitch_event_invitations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS pitch_event_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES pitch_events(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'founders', 'team')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pitch_event_announcements_event_id ON pitch_event_announcements(event_id);
CREATE INDEX IF NOT EXISTS idx_pitch_event_announcements_author_id ON pitch_event_announcements(author_id);

ALTER TABLE pitch_event_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pitch events are visible to public or related users" ON pitch_events;
CREATE POLICY "Pitch events are visible to public or related users"
  ON pitch_events FOR SELECT
  USING (
    visibility IN ('public', 'unlisted')
    OR organizer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM pitch_event_participants
      WHERE pitch_event_participants.event_id = pitch_events.id
        AND pitch_event_participants.user_id = auth.uid()
        AND pitch_event_participants.status = 'active'
    )
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
    OR EXISTS (
      SELECT 1 FROM pitch_event_participants active_member
      WHERE active_member.event_id = pitch_event_participants.event_id
        AND active_member.user_id = auth.uid()
        AND active_member.status = 'active'
    )
  );

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
    OR EXISTS (
      SELECT 1 FROM pitch_event_participants active_admin
      WHERE active_admin.event_id = pitch_event_participants.event_id
        AND active_admin.user_id = auth.uid()
        AND active_admin.role IN ('organizer', 'admin')
        AND active_admin.status = 'active'
    )
  );

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
        AND pitch_event_participants.role IN ('organizer', 'admin', 'coach', 'mentor', 'judge')
        AND pitch_event_participants.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Invitations are visible to event team" ON pitch_event_invitations;
CREATE POLICY "Invitations are visible to event team"
  ON pitch_event_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pitch_events
      WHERE pitch_events.id = pitch_event_invitations.event_id
        AND pitch_events.organizer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM pitch_event_participants
      WHERE pitch_event_participants.event_id = pitch_event_invitations.event_id
        AND pitch_event_participants.user_id = auth.uid()
        AND pitch_event_participants.role IN ('organizer', 'admin', 'coach', 'mentor', 'judge')
        AND pitch_event_participants.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Organizers and admins can create invitations" ON pitch_event_invitations;
CREATE POLICY "Organizers and admins can create invitations"
  ON pitch_event_invitations FOR INSERT
  WITH CHECK (
    invited_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM pitch_events
        WHERE pitch_events.id = pitch_event_invitations.event_id
          AND pitch_events.organizer_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM pitch_event_participants
        WHERE pitch_event_participants.event_id = pitch_event_invitations.event_id
          AND pitch_event_participants.user_id = auth.uid()
          AND pitch_event_participants.role IN ('organizer', 'admin')
          AND pitch_event_participants.status = 'active'
      )
    )
  );

DROP POLICY IF EXISTS "Organizers and admins can update invitations" ON pitch_event_invitations;
CREATE POLICY "Organizers and admins can update invitations"
  ON pitch_event_invitations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM pitch_events
      WHERE pitch_events.id = pitch_event_invitations.event_id
        AND pitch_events.organizer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM pitch_event_participants
      WHERE pitch_event_participants.event_id = pitch_event_invitations.event_id
        AND pitch_event_participants.user_id = auth.uid()
        AND pitch_event_participants.role IN ('organizer', 'admin')
        AND pitch_event_participants.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Authenticated users can accept pending invitations" ON pitch_event_invitations;
CREATE POLICY "Authenticated users can accept pending invitations"
  ON pitch_event_invitations FOR UPDATE
  USING (status = 'pending')
  WITH CHECK (
    status = 'accepted'
    AND accepted_by = auth.uid()
    AND accepted_at IS NOT NULL
  );

DROP POLICY IF EXISTS "Announcements are visible to event members" ON pitch_event_announcements;
CREATE POLICY "Announcements are visible to event members"
  ON pitch_event_announcements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pitch_events
      WHERE pitch_events.id = pitch_event_announcements.event_id
        AND pitch_events.organizer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM pitch_event_participants
      WHERE pitch_event_participants.event_id = pitch_event_announcements.event_id
        AND pitch_event_participants.user_id = auth.uid()
        AND pitch_event_participants.status = 'active'
        AND (
          pitch_event_announcements.audience = 'all'
          OR pitch_event_announcements.audience = pitch_event_participants.role
          OR (
            pitch_event_announcements.audience = 'team'
            AND pitch_event_participants.role IN ('organizer', 'admin', 'coach', 'mentor', 'judge')
          )
          OR (
            pitch_event_announcements.audience = 'founders'
            AND pitch_event_participants.role = 'founder'
          )
        )
    )
  );

DROP POLICY IF EXISTS "Event team can create announcements" ON pitch_event_announcements;
CREATE POLICY "Event team can create announcements"
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
          AND pitch_event_participants.role IN ('organizer', 'admin', 'coach', 'mentor', 'judge')
          AND pitch_event_participants.status = 'active'
      )
    )
  );

COMMENT ON TABLE pitch_event_invitations IS 'Invite links and tracked email targets for founders and event team members.';
COMMENT ON TABLE pitch_event_announcements IS 'Organizer/team announcements shown in event rooms.';
