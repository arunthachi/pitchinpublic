-- Stable public identifiers for user-facing URLs.
-- Internal UUIDs remain the database keys; these values are safe to show in browser URLs.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.pip_slugify(input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(
      TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(COALESCE(input, '')), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'founder'
  );
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_handle TEXT;

WITH handle_candidates AS (
  SELECT
    id,
    public.pip_slugify(COALESCE(NULLIF(username, ''), NULLIF(full_name, ''), SPLIT_PART(email, '@', 1), 'founder')) AS base_handle
  FROM public.profiles
  WHERE public_handle IS NULL OR public_handle = ''
),
deduped_handles AS (
  SELECT
    id,
    base_handle,
    ROW_NUMBER() OVER (PARTITION BY base_handle ORDER BY id) AS handle_rank
  FROM handle_candidates
)
UPDATE public.profiles AS profile
SET public_handle = CASE
  WHEN deduped_handles.handle_rank = 1 THEN deduped_handles.base_handle
  ELSE deduped_handles.base_handle || '-' || SUBSTRING(MD5(profile.id::TEXT), 1, 6)
END
FROM deduped_handles
WHERE profile.id = deduped_handles.id;

ALTER TABLE public.profiles
  ALTER COLUMN public_handle SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_public_handle_key
  ON public.profiles (public_handle);

CREATE OR REPLACE FUNCTION public.set_profile_public_handle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  base_handle TEXT;
  candidate_handle TEXT;
  suffix_number INTEGER := 0;
BEGIN
  IF NEW.public_handle IS NOT NULL AND NEW.public_handle <> '' THEN
    NEW.public_handle := public.pip_slugify(NEW.public_handle);
    RETURN NEW;
  END IF;

  base_handle := public.pip_slugify(COALESCE(NULLIF(NEW.username, ''), NULLIF(NEW.full_name, ''), SPLIT_PART(NEW.email, '@', 1), 'founder'));
  candidate_handle := base_handle;

  WHILE EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public_handle = candidate_handle
      AND id <> NEW.id
  ) LOOP
    suffix_number := suffix_number + 1;
    candidate_handle := base_handle || '-' || suffix_number::TEXT;
  END LOOP;

  NEW.public_handle := candidate_handle;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profile_public_handle_before_write ON public.profiles;
CREATE TRIGGER set_profile_public_handle_before_write
  BEFORE INSERT OR UPDATE OF public_handle, username, full_name, email
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profile_public_handle();

ALTER TABLE public.pitches
  ADD COLUMN IF NOT EXISTS public_id TEXT;

UPDATE public.pitches
SET public_id = 'p_' || SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 12)
WHERE public_id IS NULL OR public_id = '';

ALTER TABLE public.pitches
  ALTER COLUMN public_id SET DEFAULT ('p_' || SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 12)),
  ALTER COLUMN public_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pitches_public_id_key
  ON public.pitches (public_id);
