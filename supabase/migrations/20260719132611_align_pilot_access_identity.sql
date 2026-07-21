-- PostgREST reliably forwards auth.uid() for authenticated RPC calls, but the
-- email claim is not guaranteed to be present in every access token. Resolve
-- the canonical auth email by user id first so the database pilot gate matches
-- the application gate used before calling submit_pitch_feedback().
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins
    WHERE LOWER(email) = LOWER(COALESCE(
      (SELECT auth.users.email FROM auth.users WHERE auth.users.id = auth.uid()),
      auth.jwt() ->> 'email',
      ''
    ))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_pilot_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.is_platform_admin()
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
    );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_pilot_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_pilot_user() TO authenticated, service_role;
