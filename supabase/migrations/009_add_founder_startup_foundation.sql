-- Migration 009: Founder/startup foundation
-- Adds scalable identity, startup membership, and first-class pitch metadata.

-- =============================================
-- 1. PROFILE ROLES
-- =============================================
CREATE TABLE IF NOT EXISTS profile_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('founder', 'builder', 'investor', 'mentor', 'organizer', 'judge')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_profile_roles_user_id ON profile_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_roles_role ON profile_roles(role);

ALTER TABLE profile_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profile roles are public" ON profile_roles;
CREATE POLICY "Profile roles are public"
  ON profile_roles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage their own profile roles" ON profile_roles;
CREATE POLICY "Users can manage their own profile roles"
  ON profile_roles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Give existing users a sensible default role without overwriting future choices.
INSERT INTO profile_roles (user_id, role, is_primary)
SELECT id, 'founder', true
FROM profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- =============================================
-- 2. COMPANY MEMBERSHIPS
-- =============================================
ALTER TABLE companies
  ALTER COLUMN industry SET DEFAULT 'Other',
  ALTER COLUMN stage SET DEFAULT 'Idea';

CREATE TABLE IF NOT EXISTS company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'founder' CHECK (role IN ('founder', 'cofounder', 'team', 'advisor', 'investor', 'mentor', 'organizer', 'judge')),
  title TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user_id ON company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_role ON company_members(role);
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_members_one_primary_per_user
  ON company_members(user_id)
  WHERE is_primary = true;

ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members are visible for active companies" ON company_members;
CREATE POLICY "Company members are visible for active companies"
  ON company_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = company_members.company_id
        AND (companies.status = 'active' OR companies.founder_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Company founders can manage members" ON company_members;
CREATE POLICY "Company founders can manage members"
  ON company_members FOR ALL
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = company_members.company_id
        AND companies.founder_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = company_members.company_id
        AND companies.founder_id = auth.uid()
    )
  );

-- Backfill founder memberships for existing companies.
INSERT INTO company_members (company_id, user_id, role, is_primary)
SELECT id, founder_id, 'founder', false
FROM companies
ON CONFLICT (company_id, user_id) DO NOTHING;

-- =============================================
-- 3. FIRST-CLASS PITCH METADATA
-- =============================================
ALTER TABLE pitches
  ADD COLUMN IF NOT EXISTS startup_name TEXT,
  ADD COLUMN IF NOT EXISTS one_line_pitch TEXT,
  ADD COLUMN IF NOT EXISTS feedback_ask TEXT,
  ADD COLUMN IF NOT EXISTS extra_context TEXT,
  ADD COLUMN IF NOT EXISTS take_version INTEGER,
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('private', 'unlisted', 'public')),
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'practice' CHECK (source IN ('practice', 'pilot', 'event', 'import'));

CREATE INDEX IF NOT EXISTS idx_pitches_startup_name ON pitches(startup_name);
CREATE INDEX IF NOT EXISTS idx_pitches_take_version ON pitches(user_id, company_id, take_version);
CREATE INDEX IF NOT EXISTS idx_pitches_visibility ON pitches(visibility);

-- Backfill pitch metadata from the structured MVP description format.
UPDATE pitches
SET
  startup_name = COALESCE(
    startup_name,
    NULLIF(TRIM((regexp_match(COALESCE(description, ''), '(?im)^Startup:\s*(.+)$'))[1]), '')
  ),
  feedback_ask = COALESCE(
    feedback_ask,
    NULLIF(TRIM((regexp_match(COALESCE(description, ''), '(?im)^Feedback ask:\s*(.+)$'))[1]), '')
  ),
  extra_context = COALESCE(
    extra_context,
    NULLIF(TRIM((regexp_match(COALESCE(description, ''), '(?im)^Context:\s*(.+)$'))[1]), '')
  ),
  one_line_pitch = COALESCE(one_line_pitch, hook),
  take_version = COALESCE(take_version, version_number, 1)
WHERE startup_name IS NULL
   OR feedback_ask IS NULL
   OR extra_context IS NULL
   OR one_line_pitch IS NULL
   OR take_version IS NULL;

-- Create lightweight company records for legacy pitches with startup names but no company.
WITH legacy_startups AS (
  SELECT DISTINCT
    user_id,
    startup_name,
    lower(regexp_replace(startup_name, '[^a-zA-Z0-9]+', '-', 'g')) AS base_slug
  FROM pitches
  WHERE company_id IS NULL
    AND startup_name IS NOT NULL
    AND TRIM(startup_name) <> ''
),
inserted_companies AS (
  INSERT INTO companies (founder_id, name, slug, tagline, description, industry, stage, status)
  SELECT
    user_id,
    startup_name,
    LEFT(TRIM(BOTH '-' FROM base_slug), 48) || '-' || LEFT(REPLACE(user_id::TEXT, '-', ''), 8),
    NULL,
    NULL,
    'Other',
    'Idea',
    'active'
  FROM legacy_startups
  ON CONFLICT (slug) DO NOTHING
  RETURNING id, founder_id, name
)
INSERT INTO company_members (company_id, user_id, role, is_primary)
SELECT id, founder_id, 'founder', false
FROM inserted_companies
ON CONFLICT (company_id, user_id) DO NOTHING;

UPDATE pitches
SET company_id = companies.id
FROM companies
WHERE pitches.company_id IS NULL
  AND pitches.user_id = companies.founder_id
  AND pitches.startup_name = companies.name;

COMMENT ON TABLE profile_roles IS 'A user can hold multiple global roles, such as founder, investor, mentor, organizer, or judge.';
COMMENT ON TABLE company_members IS 'A user can belong to multiple startups/projects with different roles.';
COMMENT ON COLUMN pitches.startup_name IS 'Snapshot of startup/project name when the pitch was posted.';
COMMENT ON COLUMN pitches.one_line_pitch IS 'Snapshot of the written pitch paired with the video take.';
COMMENT ON COLUMN pitches.feedback_ask IS 'Specific feedback request shown to other builders.';
COMMENT ON COLUMN pitches.take_version IS 'Practice take number for this user/startup/goal at publish time.';
