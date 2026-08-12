-- Remove PostgREST execution grants that are not needed by the pitch-standard
-- contract. Trigger functions are never called through RPC; mutating RPCs
-- require an authenticated user and also enforce authorization internally.

REVOKE ALL ON FUNCTION public.create_event_with_standard_draft(jsonb,uuid,text) FROM anon;
REVOKE ALL ON FUNCTION public.save_event_pitch_guideline_draft(uuid,integer,text,text,jsonb,text) FROM anon;
REVOKE ALL ON FUNCTION public.publish_event_pitch_guideline_draft(uuid,integer,uuid) FROM anon;
REVOKE ALL ON FUNCTION public.start_event_recording_session(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.submit_structured_event_final_take(uuid,uuid) FROM anon;
REVOKE ALL ON FUNCTION public.submit_structured_event_pitch_feedback(uuid,text,text,uuid,uuid,text,text,text) FROM anon;

REVOKE ALL ON FUNCTION public.bind_pitch_guideline_version() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_bound_recording_session() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_pitch_binding_mutation() FROM anon, authenticated;
