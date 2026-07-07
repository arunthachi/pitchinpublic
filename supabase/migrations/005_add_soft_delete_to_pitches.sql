-- Migration 005: Add soft delete support to pitches table
-- Allows users to delete pitches without losing data integrity
-- Streaks and dependent data remain unaffected

-- =============================================
-- ALTER PITCHES TABLE
-- =============================================

-- Add deleted_at column to track when pitch was deleted
-- NULL = not deleted, timestamp = deleted at that time
ALTER TABLE pitches
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

-- Add comment explaining the column
COMMENT ON COLUMN pitches.deleted_at IS 'Timestamp when pitch was soft-deleted. NULL means pitch is active.';

-- Create index for efficient filtering of non-deleted pitches
CREATE INDEX IF NOT EXISTS idx_pitches_deleted_at ON pitches(deleted_at);

-- =============================================
-- UPDATE RLS POLICIES
-- =============================================

-- Update existing SELECT policies to exclude deleted pitches
-- Note: This assumes basic policy already exists

-- Drop old policy if exists
DROP POLICY IF EXISTS "Pitches are viewable by everyone" ON pitches;

-- Create new policy that excludes deleted pitches
CREATE POLICY "Pitches are viewable by everyone"
  ON pitches FOR SELECT
  USING (deleted_at IS NULL);

-- Update policy for users to see their own deleted pitches (if needed)
DROP POLICY IF EXISTS "Users can view their own pitches" ON pitches;

CREATE POLICY "Users can view their own pitches"
  ON pitches FOR SELECT
  USING (user_id = auth.uid());

-- Allow users to update their own pitches
DROP POLICY IF EXISTS "Users can update their own pitches" ON pitches;

CREATE POLICY "Users can update their own pitches"
  ON pitches FOR UPDATE
  USING (user_id = auth.uid());

-- =============================================
-- NOTES
-- =============================================

-- Soft delete strategy:
-- 1. When user deletes a pitch, set deleted_at = NOW()
-- 2. All SELECT queries filter: WHERE deleted_at IS NULL
-- 3. Streaks remain safe because they check created_at date
-- 4. Dependent data (reactions, views, feedback) are preserved
-- 5. Can be extended to support undo/restore in future
