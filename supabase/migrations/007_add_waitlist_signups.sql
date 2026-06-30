-- Waitlist signups for pre-launch pitchinpublic.io landing page

CREATE TABLE IF NOT EXISTS waitlist_signups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  company_name TEXT,
  website_or_linkedin TEXT,
  wants_founder_access BOOLEAN DEFAULT FALSE,
  source TEXT DEFAULT 'landing',
  referrer TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'invited', 'joined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS website_or_linkedin TEXT;
ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS wants_founder_access BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_waitlist_signups_email ON waitlist_signups(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_created_at ON waitlist_signups(created_at DESC);

ALTER TABLE waitlist_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can join waitlist" ON waitlist_signups;
CREATE POLICY "Anyone can join waitlist"
  ON waitlist_signups FOR INSERT
  WITH CHECK (true);
