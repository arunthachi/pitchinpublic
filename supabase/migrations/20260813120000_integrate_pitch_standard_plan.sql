-- Integrate the pitch standard into event creation, recording, and final submission.

CREATE TABLE public.event_pitch_guideline_drafts (
  event_id uuid PRIMARY KEY REFERENCES public.pitch_events(id) ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  instructions text NOT NULL DEFAULT '' CHECK (char_length(instructions) <= 4000),
  criteria jsonb NOT NULL CHECK (jsonb_typeof(criteria)='array' AND jsonb_array_length(criteria) BETWEEN 4 AND 6),
  disclosure_mode text NOT NULL DEFAULT 'role_only' CHECK (disclosure_mode IN ('named','role_only','anonymous_to_founder')),
  updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_pitch_guideline_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read guideline drafts" ON public.event_pitch_guideline_drafts FOR SELECT
  USING (public.is_event_manager(event_id, auth.uid()));

ALTER TABLE public.event_pitch_guideline_versions ADD COLUMN publication_key uuid;
CREATE UNIQUE INDEX event_guideline_publication_key_idx
  ON public.event_pitch_guideline_versions(event_id, publication_key) WHERE publication_key IS NOT NULL;

CREATE TABLE public.event_recording_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.pitch_events(id) ON DELETE CASCADE,
  founder_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guideline_version_id uuid NOT NULL REFERENCES public.event_pitch_guideline_versions(id) ON DELETE RESTRICT,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '4 hours'),
  consumed_by_pitch_id uuid UNIQUE REFERENCES public.pitches(id) ON DELETE SET NULL,
  consumed_at timestamptz
);
CREATE INDEX event_recording_sessions_founder_idx ON public.event_recording_sessions(founder_id, event_id, expires_at DESC);
ALTER TABLE public.event_recording_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founders read own recording sessions" ON public.event_recording_sessions FOR SELECT USING (founder_id=auth.uid());
ALTER TABLE public.pitches ADD COLUMN event_recording_session_id uuid UNIQUE REFERENCES public.event_recording_sessions(id) ON DELETE SET NULL;

CREATE TABLE public.pitch_improvement_assessments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES public.pitch_events(id) ON DELETE CASCADE,
 source_pitch_id uuid NOT NULL REFERENCES public.pitches(id), later_pitch_id uuid NOT NULL REFERENCES public.pitches(id),
 guideline_version_id uuid NOT NULL REFERENCES public.event_pitch_guideline_versions(id), assessor_id uuid NOT NULL REFERENCES public.profiles(id),
 blinded_order jsonb NOT NULL CHECK (jsonb_typeof(blinded_order)='array' AND jsonb_array_length(blinded_order)=2),
 criterion_scores jsonb NOT NULL CHECK (jsonb_typeof(criterion_scores)='array'), later_take_better boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(assessor_id,source_pitch_id,later_pitch_id)
);
CREATE INDEX pitch_improvement_assessments_event_idx ON public.pitch_improvement_assessments(event_id,created_at DESC);
ALTER TABLE public.pitch_improvement_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read improvement assessments" ON public.pitch_improvement_assessments FOR SELECT USING(public.is_event_manager(event_id,auth.uid()));

CREATE OR REPLACE FUNCTION public.validate_pitch_standard(criteria_value jsonb) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_temp AS $$
DECLARE item jsonb;
BEGIN
  IF jsonb_typeof(criteria_value)<>'array' OR jsonb_array_length(criteria_value) NOT BETWEEN 4 AND 6 THEN RAISE EXCEPTION 'Guidelines require 4 to 6 criteria'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(criteria_value) LOOP
    IF COALESCE(item->>'key','') !~ '^[a-z0-9][a-z0-9_-]{0,39}$' OR char_length(COALESCE(item->>'label','')) NOT BETWEEN 2 AND 80 THEN
      RAISE EXCEPTION 'Invalid guideline criterion';
    END IF;
  END LOOP;
  IF (SELECT count(DISTINCT value->>'key') FROM jsonb_array_elements(criteria_value))<>jsonb_array_length(criteria_value) THEN RAISE EXCEPTION 'Criterion keys must be unique'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.universal_pitch_standard() RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT jsonb_build_array(
 jsonb_build_object('key','audience','label','Who is this for?','guidance','Name the audience precisely.'),
 jsonb_build_object('key','need','label','What need, problem, or opportunity exists?','guidance','Make the stakes concrete.'),
 jsonb_build_object('key','offering','label','What are you offering or proposing?','guidance','Explain the solution plainly.'),
 jsonb_build_object('key','credibility','label','Why should the audience believe it?','guidance','Show evidence, traction, or insight.'),
 jsonb_build_object('key','next_step','label','What do you want them to do next?','guidance','End with a specific ask.'),
 jsonb_build_object('key','delivery','label','Can you communicate it clearly within the time?','guidance','Use a clear structure and finish on time.')) $$;

CREATE OR REPLACE FUNCTION public.create_event_with_standard_draft(event_payload jsonb, request_key uuid, payload_hash text)
RETURNS public.pitch_events LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE saved public.pitch_events; caller uuid:=auth.uid(); generated_slug text;
BEGIN
  IF caller IS NULL OR NOT EXISTS(SELECT 1 FROM public.profile_roles WHERE user_id=caller AND role IN ('organizer','admin')) THEN RAISE EXCEPTION 'Organizer access required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(caller::text||request_key::text,0));
  SELECT * INTO saved FROM public.pitch_events WHERE organizer_id=caller AND creation_key=request_key;
  IF saved.id IS NOT NULL THEN
    IF saved.creation_payload_hash IS DISTINCT FROM payload_hash THEN RAISE EXCEPTION 'Idempotency key payload mismatch'; END IF;
    RETURN saved;
  END IF;
  generated_slug:=left(regexp_replace(lower(COALESCE(event_payload->>'name','pitch-event')),'[^a-z0-9]+','-','g'),72)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,5);
  INSERT INTO public.pitch_events(organizer_id,name,slug,description,event_date,submission_deadline,pitch_length_seconds,focus,visibility,peer_feedback_enabled,access_code,review_target,pitch_hour_starts_at,pitch_hour_ends_at,status,creation_key,creation_payload_hash)
  VALUES(caller,event_payload->>'name',generated_slug,nullif(event_payload->>'description',''),(event_payload->>'eventDate')::date,nullif(event_payload->>'submissionDeadline','')::timestamptz,
    (event_payload->>'pitchLengthSeconds')::integer,COALESCE(event_payload->>'focus','Clarity'),COALESCE(event_payload->>'visibility','unlisted'),COALESCE((event_payload->>'peerFeedbackEnabled')::boolean,true),
    nullif(event_payload->>'accessCode',''),COALESCE((event_payload->>'reviewTarget')::integer,3),nullif(event_payload->>'pitchHourStartsAt','')::timestamptz,nullif(event_payload->>'pitchHourEndsAt','')::timestamptz,'active',request_key,payload_hash) RETURNING * INTO saved;
  INSERT INTO public.pitch_event_participants(event_id,user_id,role,status) VALUES(saved.id,caller,'organizer','active');
  INSERT INTO public.event_pitch_guideline_drafts(event_id,title,instructions,criteria,updated_by)
    VALUES(saved.id,'A clear, audience-ready pitch','Prepare a focused pitch using this event standard.',public.universal_pitch_standard(),caller);
  RETURN saved;
END $$;

CREATE OR REPLACE FUNCTION public.save_event_pitch_guideline_draft(target_event_id uuid, expected_revision integer, draft_title text, draft_instructions text, draft_criteria jsonb, disclosure text)
RETURNS public.event_pitch_guideline_drafts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE saved public.event_pitch_guideline_drafts;
BEGIN
  IF NOT public.is_event_manager(target_event_id,auth.uid()) THEN RAISE EXCEPTION 'Event manager access required'; END IF;
  PERFORM public.validate_pitch_standard(draft_criteria);
  UPDATE public.event_pitch_guideline_drafts SET revision=revision+1,title=btrim(draft_title),instructions=COALESCE(draft_instructions,''),criteria=draft_criteria,disclosure_mode=disclosure,updated_by=auth.uid(),updated_at=now()
    WHERE event_id=target_event_id AND revision=expected_revision RETURNING * INTO saved;
  IF saved.event_id IS NULL THEN RAISE EXCEPTION USING MESSAGE='draft_changed', ERRCODE='40001'; END IF;
  RETURN saved;
END $$;

CREATE OR REPLACE FUNCTION public.publish_event_pitch_guideline_draft(target_event_id uuid, expected_revision integer, publication_request_key uuid)
RETURNS public.event_pitch_guideline_versions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE draft public.event_pitch_guideline_drafts; saved public.event_pitch_guideline_versions; next_version integer;
BEGIN
  IF NOT public.is_event_manager(target_event_id,auth.uid()) THEN RAISE EXCEPTION 'Event manager access required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(target_event_id::text||publication_request_key::text,0));
  SELECT * INTO saved FROM public.event_pitch_guideline_versions WHERE event_id=target_event_id AND publication_key=publication_request_key;
  IF saved.id IS NOT NULL THEN RETURN saved; END IF;
  PERFORM 1 FROM public.pitch_events WHERE id=target_event_id FOR UPDATE;
  SELECT * INTO draft FROM public.event_pitch_guideline_drafts WHERE event_id=target_event_id AND revision=expected_revision FOR UPDATE;
  IF draft.event_id IS NULL THEN RAISE EXCEPTION USING MESSAGE='draft_changed', ERRCODE='40001'; END IF;
  SELECT COALESCE(max(version),0)+1 INTO next_version FROM public.event_pitch_guideline_versions WHERE event_id=target_event_id;
  INSERT INTO public.event_pitch_guideline_versions(event_id,version,title,instructions,criteria,created_by,publication_key)
    VALUES(target_event_id,next_version,draft.title,draft.instructions,draft.criteria,auth.uid(),publication_request_key) RETURNING * INTO saved;
  UPDATE public.pitch_events SET current_guideline_version_id=saved.id,guidance_mode='structured_active',feedback_disclosure_mode=draft.disclosure_mode,updated_at=now() WHERE id=target_event_id;
  UPDATE public.event_pitch_guideline_drafts SET revision=revision+1,updated_at=now(),updated_by=auth.uid() WHERE event_id=target_event_id;
  RETURN saved;
END $$;

CREATE OR REPLACE FUNCTION public.start_event_recording_session(target_event_id uuid, requested_guideline_version_id uuid DEFAULT NULL)
RETURNS public.event_recording_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE version_id uuid; saved public.event_recording_sessions;
BEGIN
  SELECT COALESCE(requested_guideline_version_id,current_guideline_version_id) INTO version_id FROM public.pitch_events WHERE id=target_event_id AND guidance_mode='structured_active' AND status='active';
  IF version_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.event_pitch_guideline_versions WHERE id=version_id AND event_id=target_event_id)
    OR NOT EXISTS(SELECT 1 FROM public.pitch_event_participants WHERE event_id=target_event_id AND user_id=auth.uid() AND status='active' AND role='founder')
    THEN RAISE EXCEPTION 'Active founder membership and published event standard required'; END IF;
  INSERT INTO public.event_recording_sessions(event_id,founder_id,guideline_version_id) VALUES(target_event_id,auth.uid(),version_id) RETURNING * INTO saved;
  RETURN saved;
END $$;

CREATE OR REPLACE FUNCTION public.submit_structured_event_final_take(target_event_id uuid,target_pitch_id uuid)
RETURNS public.pitch_event_submissions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE event_row public.pitch_events; pitch_row public.pitches; brief public.event_founder_pitch_briefs; saved public.pitch_event_submissions;
BEGIN
  SELECT * INTO event_row FROM public.pitch_events WHERE id=target_event_id;
  SELECT * INTO pitch_row FROM public.pitches WHERE id=target_pitch_id AND user_id=auth.uid();
  SELECT * INTO brief FROM public.event_founder_pitch_briefs WHERE event_id=target_event_id AND founder_id=auth.uid();
  IF event_row.guidance_mode<>'structured_active' OR event_row.status<>'active' OR (event_row.submission_deadline IS NOT NULL AND event_row.submission_deadline<now()) THEN RAISE EXCEPTION 'Event is not accepting submissions'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.pitch_event_participants WHERE event_id=target_event_id AND user_id=auth.uid() AND status='active' AND role='founder') THEN RAISE EXCEPTION 'Active founder membership required'; END IF;
  IF pitch_row.id IS NULL OR pitch_row.event_id<>target_event_id OR pitch_row.event_guideline_version_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.event_pitch_guideline_versions WHERE id=pitch_row.event_guideline_version_id AND event_id=target_event_id) THEN RAISE EXCEPTION 'Trusted pitch binding required'; END IF;
  IF brief.id IS NULL OR btrim(brief.tagline)='' OR btrim(brief.business_description)='' OR btrim(brief.problem)='' OR btrim(brief.ask)='' THEN RAISE EXCEPTION 'Required pitch plan fields are incomplete'; END IF;
  INSERT INTO public.pitch_event_submissions(event_id,user_id,pitch_id,status,submitted_at,updated_at,guideline_version_id)
    VALUES(target_event_id,auth.uid(),target_pitch_id,'submitted',now(),now(),pitch_row.event_guideline_version_id)
    ON CONFLICT(event_id,user_id) DO UPDATE SET pitch_id=EXCLUDED.pitch_id,status='submitted',submitted_at=now(),updated_at=now(),guideline_version_id=EXCLUDED.guideline_version_id RETURNING * INTO saved;
  RETURN saved;
END $$;

CREATE OR REPLACE FUNCTION public.assess_pitch_improvement(target_event_id uuid,source_pitch uuid,later_pitch uuid,scores jsonb,blind_order jsonb)
RETURNS public.pitch_improvement_assessments LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE source_row public.pitches; later_row public.pitches; saved public.pitch_improvement_assessments; better boolean;
BEGIN
 IF NOT public.is_event_manager(target_event_id,auth.uid()) AND NOT EXISTS(SELECT 1 FROM public.pitch_event_participants WHERE event_id=target_event_id AND user_id=auth.uid() AND status='active' AND role IN ('mentor','coach','judge')) THEN RAISE EXCEPTION 'Trusted assessor access required'; END IF;
 SELECT * INTO source_row FROM public.pitches WHERE id=source_pitch AND event_id=target_event_id;
 SELECT * INTO later_row FROM public.pitches WHERE id=later_pitch AND event_id=target_event_id;
 IF source_row.id IS NULL OR later_row.id IS NULL OR source_row.user_id<>later_row.user_id OR source_row.event_guideline_version_id IS DISTINCT FROM later_row.event_guideline_version_id OR later_row.created_at<=source_row.created_at THEN RAISE EXCEPTION 'Comparable takes with the same standard are required'; END IF;
 IF jsonb_typeof(scores)<>'array' OR jsonb_array_length(scores)<1 OR jsonb_typeof(blind_order)<>'array' OR jsonb_array_length(blind_order)<>2 THEN RAISE EXCEPTION 'Criterion scores and blinded order are required'; END IF;
 SELECT COALESCE(avg((item->>'later')::numeric)>avg((item->>'source')::numeric),false) INTO better FROM jsonb_array_elements(scores) item;
 INSERT INTO public.pitch_improvement_assessments(event_id,source_pitch_id,later_pitch_id,guideline_version_id,assessor_id,blinded_order,criterion_scores,later_take_better)
 VALUES(target_event_id,source_pitch,later_pitch,source_row.event_guideline_version_id,auth.uid(),blind_order,scores,better)
 ON CONFLICT(assessor_id,source_pitch_id,later_pitch_id) DO UPDATE SET blinded_order=EXCLUDED.blinded_order,criterion_scores=EXCLUDED.criterion_scores,later_take_better=EXCLUDED.later_take_better RETURNING * INTO saved;
 RETURN saved;
END $$;

-- Structured events fail closed; legacy events retain the old fallback behavior.
CREATE OR REPLACE FUNCTION public.bind_pitch_guideline_version() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE mode text; session public.event_recording_sessions;
BEGIN
  IF NEW.event_recording_session_id IS NOT NULL THEN
    SELECT * INTO session FROM public.event_recording_sessions WHERE id=NEW.event_recording_session_id FOR UPDATE;
    IF session.id IS NULL OR session.founder_id<>NEW.user_id OR session.expires_at<=now() OR session.consumed_by_pitch_id IS NOT NULL THEN RAISE EXCEPTION 'Invalid or expired recording session'; END IF;
    NEW.event_id:=session.event_id; NEW.event_guideline_version_id:=session.guideline_version_id; NEW.visibility:='private';
  END IF;
  IF NEW.event_id IS NOT NULL THEN
    SELECT guidance_mode INTO mode FROM public.pitch_events WHERE id=NEW.event_id;
    IF mode='structured_active' AND NEW.event_guideline_version_id IS NULL THEN RAISE EXCEPTION 'Structured pitches require a trusted recording-session binding'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.consume_bound_recording_session() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.event_recording_session_id IS NOT NULL THEN UPDATE public.event_recording_sessions SET consumed_by_pitch_id=NEW.id,consumed_at=now() WHERE id=NEW.event_recording_session_id; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER consume_bound_recording_session_after_insert AFTER INSERT ON public.pitches FOR EACH ROW EXECUTE FUNCTION public.consume_bound_recording_session();
CREATE OR REPLACE FUNCTION public.bind_submission_guideline_version() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE mode text;
BEGIN
  SELECT guidance_mode INTO mode FROM public.pitch_events WHERE id=NEW.event_id;
  IF mode='structured_active' AND NEW.guideline_version_id IS NULL THEN RAISE EXCEPTION 'Structured submissions require an exact guideline version'; END IF;
  IF mode='legacy_open' AND NEW.guideline_version_id IS NULL THEN SELECT event_guideline_version_id INTO NEW.guideline_version_id FROM public.pitches WHERE id=NEW.pitch_id; END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.create_event_with_standard_draft(jsonb,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_event_pitch_guideline_draft(uuid,integer,text,text,jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_event_pitch_guideline_draft(uuid,integer,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_event_recording_session(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_structured_event_final_take(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assess_pitch_improvement(uuid,uuid,uuid,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_event_with_standard_draft(jsonb,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_event_pitch_guideline_draft(uuid,integer,text,text,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_event_pitch_guideline_draft(uuid,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_event_recording_session(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_structured_event_final_take(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assess_pitch_improvement(uuid,uuid,uuid,jsonb,jsonb) TO authenticated;

REVOKE ALL ON public.event_pitch_guideline_drafts, public.event_recording_sessions, public.pitch_improvement_assessments FROM anon, authenticated;
GRANT SELECT ON public.event_pitch_guideline_drafts, public.event_recording_sessions, public.pitch_improvement_assessments TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.event_pitch_guideline_versions FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.bind_pitch_guideline_version(), public.consume_bound_recording_session() FROM PUBLIC;
