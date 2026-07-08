-- Migration 010: Public lead requests
-- Stores founder and organizer interest before best-effort email notification.

CREATE TABLE IF NOT EXISTS lead_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('founder', 'organizer')),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  website TEXT,
  source TEXT,
  user_agent TEXT,
  notification_status TEXT NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending', 'sent', 'failed', 'not_configured')),
  notification_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_requests_type ON lead_requests(type);
CREATE INDEX IF NOT EXISTS idx_lead_requests_email ON lead_requests(email);
CREATE INDEX IF NOT EXISTS idx_lead_requests_created_at ON lead_requests(created_at DESC);

ALTER TABLE lead_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can create lead requests" ON lead_requests;
CREATE POLICY "Anyone can create lead requests"
  ON lead_requests FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view lead requests" ON lead_requests;
