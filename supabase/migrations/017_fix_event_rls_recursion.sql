-- Migration 017: Fix recursive event RLS policies
-- Cross-checks between pitch_events and pitch_event_participants caused
-- "infinite recursion detected in policy" during organizer event creation.

CREATE OR REPLACE FUNCTION public.is_pitch_event_owner(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pitch_events
    WHERE id = target_event_id
      AND organizer_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_pitch_event_member(
  target_event_id uuid,
  allowed_roles text[] DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pitch_event_participants
    WHERE event_id = target_event_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND (allowed_roles IS NULL OR role = ANY(allowed_roles))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_pitch_event_announcement(
  target_event_id uuid,
  target_audience text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.is_pitch_event_owner(target_event_id)
    OR EXISTS (
      SELECT 1
      FROM public.pitch_event_participants
      WHERE event_id = target_event_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND (
          target_audience = 'all'
          OR target_audience = role
          OR (
            target_audience = 'team'
            AND role IN ('organizer', 'admin', 'coach', 'mentor', 'judge')
          )
          OR (
            target_audience = 'founders'
            AND role = 'founder'
          )
        )
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_pitch_event_owner(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_pitch_event_member(uuid, text[]) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_pitch_event_announcement(uuid, text) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Pitch events are visible to public or related users" ON public.pitch_events;
CREATE POLICY "Pitch events are visible to public or related users"
  ON public.pitch_events FOR SELECT
  USING (
    visibility IN ('public', 'unlisted')
    OR organizer_id = auth.uid()
    OR public.is_pitch_event_member(id)
  );

DROP POLICY IF EXISTS "Participants are visible to event members" ON public.pitch_event_participants;
CREATE POLICY "Participants are visible to event members"
  ON public.pitch_event_participants FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_pitch_event_owner(event_id)
    OR public.is_pitch_event_member(event_id)
  );

DROP POLICY IF EXISTS "Participants and organizers can update participants" ON public.pitch_event_participants;
CREATE POLICY "Participants and organizers can update participants"
  ON public.pitch_event_participants FOR UPDATE
  USING (
    user_id = auth.uid()
    OR public.is_pitch_event_owner(event_id)
    OR public.is_pitch_event_member(event_id, ARRAY['organizer', 'admin'])
  );

DROP POLICY IF EXISTS "Submissions are visible to owner and organizers" ON public.pitch_event_submissions;
CREATE POLICY "Submissions are visible to owner and organizers"
  ON public.pitch_event_submissions FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_pitch_event_owner(event_id)
    OR public.is_pitch_event_member(event_id, ARRAY['organizer', 'admin', 'coach', 'mentor', 'judge'])
  );

DROP POLICY IF EXISTS "Invitations are visible to event team" ON public.pitch_event_invitations;
CREATE POLICY "Invitations are visible to event team"
  ON public.pitch_event_invitations FOR SELECT
  USING (
    public.is_pitch_event_owner(event_id)
    OR public.is_pitch_event_member(event_id, ARRAY['organizer', 'admin', 'coach', 'mentor', 'judge'])
  );

DROP POLICY IF EXISTS "Organizers and admins can create invitations" ON public.pitch_event_invitations;
CREATE POLICY "Organizers and admins can create invitations"
  ON public.pitch_event_invitations FOR INSERT
  WITH CHECK (
    invited_by = auth.uid()
    AND (
      public.is_pitch_event_owner(event_id)
      OR public.is_pitch_event_member(event_id, ARRAY['organizer', 'admin'])
    )
  );

DROP POLICY IF EXISTS "Organizers and admins can update invitations" ON public.pitch_event_invitations;
CREATE POLICY "Organizers and admins can update invitations"
  ON public.pitch_event_invitations FOR UPDATE
  USING (
    public.is_pitch_event_owner(event_id)
    OR public.is_pitch_event_member(event_id, ARRAY['organizer', 'admin'])
  );

DROP POLICY IF EXISTS "Announcements are visible to event members" ON public.pitch_event_announcements;
CREATE POLICY "Announcements are visible to event members"
  ON public.pitch_event_announcements FOR SELECT
  USING (public.can_view_pitch_event_announcement(event_id, audience));

DROP POLICY IF EXISTS "Event team can create announcements" ON public.pitch_event_announcements;
DROP POLICY IF EXISTS "Organizers and admins can create announcements" ON public.pitch_event_announcements;
CREATE POLICY "Organizers and admins can create announcements"
  ON public.pitch_event_announcements FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (
      public.is_pitch_event_owner(event_id)
      OR public.is_pitch_event_member(event_id, ARRAY['organizer', 'admin'])
    )
  );
