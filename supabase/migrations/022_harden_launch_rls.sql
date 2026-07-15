-- Harden launch-critical RLS policies.
-- 1. Only published, active pitches are publicly visible.
-- 2. Event participant inserts should happen through server-validated join flows.

-- Public pitch reads should not expose drafts, processing rows, or soft-deleted takes.
DROP POLICY IF EXISTS "Pitches are viewable by everyone" ON public.pitches;
DROP POLICY IF EXISTS "Published pitches are viewable by everyone" ON public.pitches;
DROP POLICY IF EXISTS "Published active pitches are viewable by everyone" ON public.pitches;

CREATE POLICY "Published active pitches are viewable by everyone"
  ON public.pitches FOR SELECT
  USING (status = 'published' AND deleted_at IS NULL);

-- Users can still see their own pitches regardless of publication status.
DROP POLICY IF EXISTS "Users can view their own pitches" ON public.pitches;
CREATE POLICY "Users can view their own pitches"
  ON public.pitches FOR SELECT
  USING (user_id = auth.uid());

-- Avoid direct client-side joins to invite-only event dashboards. The join API
-- validates access code / email-bound invitation / visibility, then writes with
-- the service role. Public and unlisted events can still allow self-join if a
-- future client-only flow needs it, but private events cannot be joined by
-- guessing an event id.
CREATE SCHEMA IF NOT EXISTS app_private;

CREATE OR REPLACE FUNCTION app_private.can_self_join_visible_pitch_event(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pitch_events pe
    WHERE pe.id = target_event_id
      AND pe.visibility IN ('public', 'unlisted')
      AND COALESCE(pe.status, 'active') = 'active'
  );
$$;

REVOKE ALL ON FUNCTION app_private.can_self_join_visible_pitch_event(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.can_self_join_visible_pitch_event(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can join pitch events" ON public.pitch_event_participants;
DROP POLICY IF EXISTS "Users can join visible pitch events" ON public.pitch_event_participants;

CREATE POLICY "Users can join visible pitch events"
  ON public.pitch_event_participants FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'founder'
    AND status = 'active'
    AND app_private.can_self_join_visible_pitch_event(event_id)
  );
