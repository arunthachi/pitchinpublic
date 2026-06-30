-- Waitlist signups for pre-launch pitchinpublic.io landing page

CREATE TABLE IF NOT EXISTS waitlist_signups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  source TEXT DEFAULT 'landing',
  referrer TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'invited', 'joined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_signups_email ON waitlist_signups(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_created_at ON waitlist_signups(created_at DESC);

ALTER TABLE waitlist_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can join waitlist" ON waitlist_signups;
CREATE POLICY "Anyone can join waitlist"
  ON waitlist_signups FOR INSERT
  WITH CHECK (true);
