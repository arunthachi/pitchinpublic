-- Platform-level super admins.
-- This is intentionally separate from event team role "admin".

CREATE TABLE IF NOT EXISTS platform_admins (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can view own admin row" ON platform_admins;
CREATE POLICY "Platform admins can view own admin row"
  ON platform_admins FOR SELECT
  USING (LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')));

INSERT INTO platform_admins (email, role)
VALUES ('arun@pitchinpublic.io', 'super_admin')
ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role;

COMMENT ON TABLE platform_admins IS 'Platform-wide super admins who can manage organizer invitations and high-level user visibility.';
