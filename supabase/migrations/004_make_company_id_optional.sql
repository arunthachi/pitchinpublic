-- Migration 004: Make company_id optional in pitches table (Phase 1 MVP)
-- For MVP, users can create pitches without requiring a company
-- This allows Phase 1 to work without the companies workflow

-- =============================================
-- ALTER PITCHES TABLE
-- =============================================

-- Drop the NOT NULL constraint on company_id
-- First drop the foreign key constraint
ALTER TABLE pitches
DROP CONSTRAINT pitches_company_id_fkey;

-- Alter the column to allow NULL
ALTER TABLE pitches
ALTER COLUMN company_id DROP NOT NULL;

-- Recreate the foreign key (now allows NULL)
ALTER TABLE pitches
ADD CONSTRAINT pitches_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES companies(id)
ON DELETE CASCADE;

-- Add comment explaining the change
COMMENT ON COLUMN pitches.company_id IS 'Optional company reference. NULL for MVP phase where users can create pitches independently.';
