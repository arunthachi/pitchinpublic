-- Adds invite-only global organizer access.
-- Event/team invites stay event-scoped; this table controls who can create organizer rooms.

CREATE TABLE IF NOT EXISTS organizer_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  organization_name TEXT,
  website TEXT,
  invite_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  accepted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizer_invitations_email ON organizer_invitations(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_organizer_invitations_code ON organizer_invitations(invite_code);
CREATE INDEX IF NOT EXISTS idx_organizer_invitations_status ON organizer_invitations(status);
CREATE INDEX IF NOT EXISTS idx_organizer_invitations_accepted_by ON organizer_invitations(accepted_by);

DROP TRIGGER IF EXISTS update_organizer_invitations_updated_at ON organizer_invitations;
CREATE TRIGGER update_organizer_invitations_updated_at
  BEFORE UPDATE ON organizer_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE organizer_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their organizer invitations" ON organizer_invitations;
CREATE POLICY "Users can view their organizer invitations"
  ON organizer_invitations FOR SELECT
  USING (
    accepted_by = auth.uid()
    OR LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  );

-- No client insert/update/delete policies are granted. Organizer invites are created
-- manually by admins or by service-role tooling and accepted through a server route.

COMMENT ON TABLE organizer_invitations IS 'Invite-only access grants for users who can create and manage organizer event rooms.';
