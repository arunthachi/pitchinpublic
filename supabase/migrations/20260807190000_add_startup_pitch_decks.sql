-- Founder pitch decks: one optional deck per startup, stored as either an
-- uploaded file in a private bucket or an external https link.
--
-- Deck metadata lives in its own table (NOT on companies) because companies
-- has a public SELECT policy; deck visibility must stay deny-by-default with
-- team access mediated by server routes using the service role.
--
-- Down migration (manual):
--   DROP TABLE IF EXISTS startup_decks;
--   DELETE FROM storage.buckets WHERE id = 'pitch-decks';
--   (bucket delete requires the bucket to be empty)

CREATE TABLE IF NOT EXISTS startup_decks (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  founder_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('file', 'link')),
  link_url TEXT,
  storage_path TEXT,
  file_name TEXT,
  file_size_bytes BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT startup_decks_source_shape CHECK (
    (kind = 'link' AND link_url IS NOT NULL AND storage_path IS NULL)
    OR
    (kind = 'file' AND storage_path IS NOT NULL AND file_name IS NOT NULL AND link_url IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_startup_decks_founder ON startup_decks(founder_id);

ALTER TABLE startup_decks ENABLE ROW LEVEL SECURITY;

-- Owner may read their own deck row. All writes and all team/admin reads go
-- through server routes with the service role; no other policies exist on
-- purpose (deny-by-default).
DROP POLICY IF EXISTS "Founders can view their own deck" ON startup_decks;
CREATE POLICY "Founders can view their own deck"
  ON startup_decks FOR SELECT
  USING (auth.uid() = founder_id);

COMMENT ON TABLE startup_decks IS 'One optional pitch deck per startup: an uploaded file in the private pitch-decks bucket or an external https link. Team access is server-mediated only.';

-- Private bucket for uploaded decks. No storage.objects policies are added:
-- with RLS enabled and no policies, anon/authenticated clients cannot read or
-- write objects. Uploads use server-issued signed upload URLs; reads use
-- server-issued signed download URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pitch-decks',
  'pitch-decks',
  false,
  26214400, -- 25MB
  ARRAY[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
ON CONFLICT (id) DO NOTHING;
