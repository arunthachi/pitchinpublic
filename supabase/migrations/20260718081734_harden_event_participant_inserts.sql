-- Participant membership is an authorization boundary. All inserts must pass
-- through the event creation or join API, where organizer ownership, room
-- visibility, access codes, email-bound invitations, expiry, and one-time
-- consumption are validated before a service-role write.
--
-- PostgreSQL ORs permissive RLS policies. Migration 023 accidentally added a
-- broad founder self-insert policy alongside the earlier visibility policy,
-- allowing a caller who learned an event UUID to bypass invite-only access.
DROP POLICY IF EXISTS "Users can join pitch events" ON public.pitch_event_participants;
DROP POLICY IF EXISTS "Users can join visible pitch events" ON public.pitch_event_participants;
DROP POLICY IF EXISTS "Users can join pitch events as founders" ON public.pitch_event_participants;

COMMENT ON TABLE public.pitch_event_participants IS
  'Event memberships. Inserts are server-only after validated organizer creation or invitation acceptance.';
