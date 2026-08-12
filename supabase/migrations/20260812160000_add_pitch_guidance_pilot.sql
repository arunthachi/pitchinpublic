-- Pilot guidance loop: immutable event standards, event-specific founder briefs,
-- criterion-bound feedback provenance, and founder-selected improvement actions.

ALTER TABLE public.pitch_events
  ADD COLUMN IF NOT EXISTS guidance_mode text NOT NULL DEFAULT 'legacy_open'
    CHECK (guidance_mode IN ('legacy_open', 'structured_active')),
  ADD COLUMN IF NOT EXISTS feedback_disclosure_mode text NOT NULL DEFAULT 'role_only'
    CHECK (feedback_disclosure_mode IN ('named', 'role_only', 'anonymous_to_founder'));

CREATE TABLE IF NOT EXISTS public.event_pitch_guideline_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.pitch_events(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  instructions text NOT NULL DEFAULT '' CHECK (char_length(instructions) <= 4000),
  criteria jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, version),
  CHECK (jsonb_typeof(criteria) = 'array' AND jsonb_array_length(criteria) BETWEEN 4 AND 6)
);

ALTER TABLE public.pitch_events
  ADD COLUMN IF NOT EXISTS current_guideline_version_id uuid
    REFERENCES public.event_pitch_guideline_versions(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS public.event_founder_pitch_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.pitch_events(id) ON DELETE CASCADE,
  founder_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guideline_version_id uuid NOT NULL REFERENCES public.event_pitch_guideline_versions(id) ON DELETE RESTRICT,
  tagline text NOT NULL DEFAULT '' CHECK (char_length(tagline) <= 60),
  business_stage text NOT NULL DEFAULT '' CHECK (char_length(business_stage) <= 80),
  industry text NOT NULL DEFAULT '' CHECK (char_length(industry) <= 120),
  business_description text NOT NULL DEFAULT '' CHECK (char_length(business_description) <= 1800),
  problem text NOT NULL DEFAULT '' CHECK (char_length(problem) <= 1200),
  ask text NOT NULL DEFAULT '' CHECK (char_length(ask) <= 600),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, founder_id)
);

ALTER TABLE public.pitches
  ADD COLUMN IF NOT EXISTS event_guideline_version_id uuid
    REFERENCES public.event_pitch_guideline_versions(id) ON DELETE RESTRICT;

ALTER TABLE public.pitch_event_submissions
  ADD COLUMN IF NOT EXISTS guideline_version_id uuid
    REFERENCES public.event_pitch_guideline_versions(id) ON DELETE RESTRICT;

ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS event_guideline_version_id uuid
    REFERENCES public.event_pitch_guideline_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS criterion_key text,
  ADD COLUMN IF NOT EXISTS observation text CHECK (observation IS NULL OR char_length(observation) <= 1200),
  ADD COLUMN IF NOT EXISTS next_step text CHECK (next_step IS NULL OR char_length(next_step) <= 1200),
  ADD COLUMN IF NOT EXISTS disclosure_mode text NOT NULL DEFAULT 'role_only'
    CHECK (disclosure_mode IN ('named', 'role_only', 'anonymous_to_founder'));

CREATE TABLE IF NOT EXISTS public.pitch_guidance_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.pitch_events(id) ON DELETE CASCADE,
  founder_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feedback_id uuid NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  source_pitch_id uuid NOT NULL REFERENCES public.pitches(id) ON DELETE CASCADE,
  guideline_version_id uuid NOT NULL REFERENCES public.event_pitch_guideline_versions(id) ON DELETE RESTRICT,
  criterion_key text NOT NULL,
  next_step text NOT NULL CHECK (char_length(next_step) BETWEEN 1 AND 1200),
  status text NOT NULL DEFAULT 'selected' CHECK (status IN ('selected', 'addressed')),
  addressed_by_pitch_id uuid REFERENCES public.pitches(id) ON DELETE SET NULL,
  selected_at timestamptz NOT NULL DEFAULT now(),
  addressed_at timestamptz,
  UNIQUE (founder_id, feedback_id)
);

CREATE INDEX IF NOT EXISTS event_guidelines_event_idx ON public.event_pitch_guideline_versions(event_id, version DESC);
CREATE INDEX IF NOT EXISTS founder_briefs_event_idx ON public.event_founder_pitch_briefs(event_id, founder_id);
CREATE INDEX IF NOT EXISTS guidance_actions_founder_idx ON public.pitch_guidance_actions(event_id, founder_id, status);

CREATE OR REPLACE FUNCTION public.bind_pitch_guideline_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.event_id IS NOT NULL AND NEW.event_guideline_version_id IS NULL THEN
    SELECT current_guideline_version_id INTO NEW.event_guideline_version_id FROM public.pitch_events WHERE id=NEW.event_id;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER bind_pitch_guideline_version_before_write BEFORE INSERT OR UPDATE OF event_id ON public.pitches
FOR EACH ROW EXECUTE FUNCTION public.bind_pitch_guideline_version();

CREATE OR REPLACE FUNCTION public.bind_submission_guideline_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.guideline_version_id IS NULL THEN
    SELECT COALESCE(p.event_guideline_version_id, e.current_guideline_version_id) INTO NEW.guideline_version_id
    FROM public.pitches p JOIN public.pitch_events e ON e.id=NEW.event_id
    WHERE p.id=NEW.pitch_id AND (p.event_id IS NULL OR p.event_id=NEW.event_id);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER bind_submission_guideline_version_before_write BEFORE INSERT OR UPDATE OF pitch_id ON public.pitch_event_submissions
FOR EACH ROW EXECUTE FUNCTION public.bind_submission_guideline_version();

CREATE OR REPLACE FUNCTION public.is_event_manager(target_event_id uuid, caller_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pitch_events e WHERE e.id = target_event_id AND e.organizer_id = caller_id
    UNION ALL
    SELECT 1 FROM public.pitch_event_participants p
    WHERE p.event_id = target_event_id AND p.user_id = caller_id
      AND p.status = 'active' AND p.role IN ('organizer', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.publish_event_pitch_guidelines(
  target_event_id uuid, guideline_title text, guideline_instructions text,
  guideline_criteria jsonb, disclosure text DEFAULT 'role_only'
) RETURNS public.event_pitch_guideline_versions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE next_version integer; saved public.event_pitch_guideline_versions; item jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_event_manager(target_event_id, auth.uid()) THEN
    RAISE EXCEPTION 'Event manager access required';
  END IF;
  IF disclosure NOT IN ('named', 'role_only', 'anonymous_to_founder') THEN RAISE EXCEPTION 'Invalid disclosure mode'; END IF;
  IF jsonb_typeof(guideline_criteria) <> 'array' OR jsonb_array_length(guideline_criteria) NOT BETWEEN 4 AND 6 THEN
    RAISE EXCEPTION 'Guidelines require 4 to 6 criteria';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(guideline_criteria) LOOP
    IF jsonb_typeof(item) <> 'object' OR COALESCE(item->>'key','') !~ '^[a-z0-9][a-z0-9_-]{0,39}$'
       OR char_length(COALESCE(item->>'label','')) NOT BETWEEN 2 AND 80
       OR char_length(COALESCE(item->>'guidance','')) > 600 THEN
      RAISE EXCEPTION 'Each criterion needs a stable key, label, and optional guidance';
    END IF;
  END LOOP;
  IF (SELECT count(DISTINCT value->>'key') FROM jsonb_array_elements(guideline_criteria)) <> jsonb_array_length(guideline_criteria) THEN
    RAISE EXCEPTION 'Criterion keys must be unique';
  END IF;
  PERFORM 1 FROM public.pitch_events WHERE id = target_event_id FOR UPDATE;
  SELECT COALESCE(max(version), 0) + 1 INTO next_version FROM public.event_pitch_guideline_versions WHERE event_id = target_event_id;
  INSERT INTO public.event_pitch_guideline_versions(event_id,version,title,instructions,criteria,created_by)
  VALUES(target_event_id,next_version,btrim(guideline_title),COALESCE(guideline_instructions,''),guideline_criteria,auth.uid()) RETURNING * INTO saved;
  UPDATE public.pitch_events SET current_guideline_version_id=saved.id, guidance_mode='structured_active',
    feedback_disclosure_mode=disclosure, updated_at=now() WHERE id=target_event_id;
  RETURN saved;
END; $$;

CREATE OR REPLACE FUNCTION public.save_event_founder_pitch_brief(
  target_event_id uuid, brief_tagline text, brief_stage text, brief_industry text,
  brief_description text, brief_problem text, brief_ask text
) RETURNS public.event_founder_pitch_briefs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE guideline_id uuid; saved public.event_founder_pitch_briefs;
BEGIN
  SELECT current_guideline_version_id INTO guideline_id FROM public.pitch_events WHERE id=target_event_id;
  IF auth.uid() IS NULL OR guideline_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.pitch_event_participants p WHERE p.event_id=target_event_id
    AND p.user_id=auth.uid() AND p.status='active' AND p.role='founder'
  ) THEN RAISE EXCEPTION 'Active founder access and published guidelines required'; END IF;
  INSERT INTO public.event_founder_pitch_briefs(event_id,founder_id,guideline_version_id,tagline,business_stage,industry,business_description,problem,ask)
  VALUES(target_event_id,auth.uid(),guideline_id,COALESCE(brief_tagline,''),COALESCE(brief_stage,''),COALESCE(brief_industry,''),COALESCE(brief_description,''),COALESCE(brief_problem,''),COALESCE(brief_ask,''))
  ON CONFLICT(event_id,founder_id) DO UPDATE SET guideline_version_id=EXCLUDED.guideline_version_id,tagline=EXCLUDED.tagline,
    business_stage=EXCLUDED.business_stage,industry=EXCLUDED.industry,business_description=EXCLUDED.business_description,
    problem=EXCLUDED.problem,ask=EXCLUDED.ask,updated_at=now() RETURNING * INTO saved;
  RETURN saved;
END; $$;

CREATE OR REPLACE FUNCTION public.select_pitch_guidance_action(target_feedback_id uuid)
RETURNS public.pitch_guidance_actions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE f public.feedback; p public.pitches; event_id_value uuid; saved public.pitch_guidance_actions;
BEGIN
  SELECT * INTO f FROM public.feedback WHERE id=target_feedback_id;
  SELECT * INTO p FROM public.pitches WHERE id=f.pitch_id AND user_id=auth.uid();
  SELECT event_id INTO event_id_value FROM public.event_pitch_guideline_versions WHERE id=f.event_guideline_version_id;
  IF p.id IS NULL OR event_id_value IS NULL OR f.criterion_key IS NULL OR COALESCE(f.next_step,'')='' THEN
    RAISE EXCEPTION 'Actionable event feedback required';
  END IF;
  INSERT INTO public.pitch_guidance_actions(event_id,founder_id,feedback_id,source_pitch_id,guideline_version_id,criterion_key,next_step)
  VALUES(event_id_value,auth.uid(),f.id,p.id,f.event_guideline_version_id,f.criterion_key,f.next_step)
  ON CONFLICT(founder_id,feedback_id) DO UPDATE SET next_step=EXCLUDED.next_step RETURNING * INTO saved;
  RETURN saved;
END; $$;

CREATE OR REPLACE FUNCTION public.submit_structured_event_pitch_feedback(
  target_pitch_id uuid, feedback_type text, feedback_content text, target_event_id uuid,
  submission_key uuid, criterion text, observed text, recommended_next_step text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE saved_id uuid; guideline_id uuid; disclosure text;
BEGIN
  SELECT COALESCE(p.event_guideline_version_id, s.guideline_version_id, e.current_guideline_version_id), e.feedback_disclosure_mode
  INTO guideline_id, disclosure
  FROM public.pitch_events e
  JOIN public.pitches p ON p.id=target_pitch_id
  LEFT JOIN public.pitch_event_submissions s ON s.event_id=e.id AND s.pitch_id=p.id
  WHERE e.id=target_event_id AND e.guidance_mode='structured_active'
    AND (p.event_id=e.id OR s.id IS NOT NULL);
  IF guideline_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.event_pitch_guideline_versions g, jsonb_array_elements(g.criteria) item
    WHERE g.id=guideline_id AND item->>'key'=criterion
  ) THEN RAISE EXCEPTION 'A current guideline criterion is required'; END IF;
  IF char_length(btrim(COALESCE(observed,''))) < 2 OR char_length(btrim(COALESCE(recommended_next_step,''))) < 2 THEN
    RAISE EXCEPTION 'Observation and next step are required';
  END IF;
  SELECT result.feedback_id INTO saved_id FROM public.submit_event_pitch_feedback(
    target_pitch_id, feedback_type, feedback_content, submission_key, target_event_id
  ) result;
  UPDATE public.feedback SET event_guideline_version_id=guideline_id, criterion_key=criterion,
    observation=btrim(observed), next_step=btrim(recommended_next_step), disclosure_mode=disclosure
  WHERE id=saved_id AND user_id=auth.uid();
  RETURN saved_id;
END; $$;

CREATE OR REPLACE FUNCTION public.mark_pitch_guidance_action_addressed(target_action_id uuid, later_pitch_id uuid)
RETURNS public.pitch_guidance_actions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE saved public.pitch_guidance_actions;
BEGIN
  UPDATE public.pitch_guidance_actions a SET status='addressed', addressed_by_pitch_id=later_pitch_id, addressed_at=now()
  WHERE a.id=target_action_id AND a.founder_id=auth.uid() AND EXISTS (
    SELECT 1 FROM public.pitches p WHERE p.id=later_pitch_id AND p.user_id=auth.uid()
      AND p.event_id=a.event_id AND p.created_at>a.selected_at
  ) RETURNING * INTO saved;
  IF saved.id IS NULL THEN RAISE EXCEPTION 'A later take in the same event is required'; END IF;
  RETURN saved;
END; $$;

ALTER TABLE public.event_pitch_guideline_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_founder_pitch_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitch_guidance_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event members can read published pitch guidelines" ON public.event_pitch_guideline_versions FOR SELECT USING (
  public.is_event_manager(event_id, auth.uid()) OR EXISTS (SELECT 1 FROM public.pitch_event_participants p WHERE p.event_id=event_id AND p.user_id=auth.uid() AND p.status='active')
);
CREATE POLICY "Founders and managers can read event briefs" ON public.event_founder_pitch_briefs FOR SELECT USING (
  founder_id=auth.uid() OR public.is_event_manager(event_id, auth.uid())
);
CREATE POLICY "Founders and managers can read guidance actions" ON public.pitch_guidance_actions FOR SELECT USING (
  founder_id=auth.uid() OR public.is_event_manager(event_id, auth.uid())
);

REVOKE ALL ON FUNCTION public.is_event_manager(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_event_pitch_guidelines(uuid,text,text,jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_event_founder_pitch_brief(uuid,text,text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.select_pitch_guidance_action(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_pitch_guidance_action_addressed(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_structured_event_pitch_feedback(uuid,text,text,uuid,uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_event_manager(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_event_pitch_guidelines(uuid,text,text,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_event_founder_pitch_brief(uuid,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.select_pitch_guidance_action(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_pitch_guidance_action_addressed(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_structured_event_pitch_feedback(uuid,text,text,uuid,uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_guideline_version_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$ BEGIN RAISE EXCEPTION 'Published guideline versions are immutable'; END; $$;
CREATE TRIGGER immutable_event_pitch_guideline_versions BEFORE UPDATE ON public.event_pitch_guideline_versions
FOR EACH ROW EXECUTE FUNCTION public.prevent_guideline_version_mutation();

COMMENT ON COLUMN public.pitch_events.guidance_mode IS 'Legacy events remain open until their first guideline version is published.';
COMMENT ON COLUMN public.feedback.disclosure_mode IS 'Controls founder-facing identity disclosure; reviewer identity remains stored for accountability.';
