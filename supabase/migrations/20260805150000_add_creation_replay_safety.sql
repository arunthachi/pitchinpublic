-- Replay-safe creation for pitches and pitch events.
ALTER TABLE public.pitches
  ADD COLUMN IF NOT EXISTS creation_key uuid,
  ADD COLUMN IF NOT EXISTS creation_payload_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS pitches_user_creation_key_unique
  ON public.pitches (user_id, creation_key)
  WHERE creation_key IS NOT NULL;

ALTER TABLE public.pitch_events
  ADD COLUMN IF NOT EXISTS creation_key uuid,
  ADD COLUMN IF NOT EXISTS creation_payload_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS pitch_events_organizer_creation_key_unique
  ON public.pitch_events (organizer_id, creation_key)
  WHERE creation_key IS NOT NULL;

-- Preserve duplicate legacy invitations while nominating one active row per
-- event/email/role as the canonical row used by all new replay-safe writes.
ALTER TABLE public.pitch_event_invitations
  ADD COLUMN IF NOT EXISTS dedupe_email text;

WITH ranked_active_invites AS (
  SELECT
    id,
    lower(btrim(email)) AS normalized_email,
    row_number() OVER (
      PARTITION BY event_id, lower(btrim(email)), role
      ORDER BY
        (dedupe_email IS NOT NULL) DESC,
        (status = 'accepted') DESC,
        created_at DESC,
        id DESC
    ) AS row_number
  FROM public.pitch_event_invitations
  WHERE email IS NOT NULL
    AND btrim(email) <> ''
    AND status IN ('pending', 'accepted')
)
UPDATE public.pitch_event_invitations AS invitation
SET dedupe_email = ranked.normalized_email
FROM ranked_active_invites AS ranked
WHERE invitation.id = ranked.id
  AND ranked.row_number = 1
  AND invitation.dedupe_email IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pitch_event_invitations_active_email_role_unique
  ON public.pitch_event_invitations (event_id, dedupe_email, role)
  WHERE dedupe_email IS NOT NULL
    AND status IN ('pending', 'accepted');
