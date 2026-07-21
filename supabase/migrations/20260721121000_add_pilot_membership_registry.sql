-- Keep pilot authorization durable and shared between the application and
-- database RPCs. Existing accounts are grandfathered; new accounts still need
-- an organizer/event invitation or an explicit membership grant.
CREATE TABLE IF NOT EXISTS public.pilot_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT pilot_members_source_check CHECK (
    source IN ('existing_account', 'manual', 'organizer_invite', 'event_invite')
  )
);

ALTER TABLE public.pilot_members ENABLE ROW LEVEL SECURITY;

-- Preserve access for founders who were already using the product before the
-- invite-only gate was introduced.
INSERT INTO public.pilot_members (user_id, source, granted_at)
SELECT id, 'existing_account', COALESCE(created_at, now())
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

DROP POLICY IF EXISTS "Members can view their own pilot access" ON public.pilot_members;
CREATE POLICY "Members can view their own pilot access"
  ON public.pilot_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_pilot_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.pilot_members
        WHERE user_id = auth.uid()
      )
      OR public.is_platform_admin()
      OR EXISTS (
        SELECT 1
        FROM public.organizer_invitations
        WHERE LOWER(email) = LOWER(COALESCE(
          (SELECT auth.users.email FROM auth.users WHERE auth.users.id = auth.uid()),
          auth.jwt() ->> 'email',
          ''
        ))
          AND status IN ('pending', 'accepted')
          AND (expires_at IS NULL OR expires_at >= now())
      )
      OR EXISTS (
        SELECT 1
        FROM public.pitch_event_invitations
        WHERE LOWER(email) = LOWER(COALESCE(
          (SELECT auth.users.email FROM auth.users WHERE auth.users.id = auth.uid()),
          auth.jwt() ->> 'email',
          ''
        ))
          AND status IN ('pending', 'accepted')
      )
    );
$$;

REVOKE ALL ON TABLE public.pilot_members FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.pilot_members TO authenticated;
REVOKE ALL ON FUNCTION public.is_pilot_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_pilot_user() TO authenticated, service_role;
