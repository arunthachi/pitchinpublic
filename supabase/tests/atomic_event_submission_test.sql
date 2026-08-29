BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(17);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data
) VALUES
  ('51000000-0000-0000-0000-000000000001', 'atomic-organizer@example.test', 'authenticated', 'authenticated', '', now(), '{}'::jsonb, '{"full_name":"Organizer"}'::jsonb),
  ('51000000-0000-0000-0000-000000000002', 'atomic-founder@example.test', 'authenticated', 'authenticated', '', now(), '{}'::jsonb, '{"full_name":"Founder"}'::jsonb);

INSERT INTO public.pitch_events (id, organizer_id, name, slug, event_date, status)
VALUES
  ('52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'Atomic event', 'atomic-event', current_date, 'active'),
  ('52000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', 'Other event', 'other-atomic-event', current_date, 'active');

INSERT INTO public.pitch_event_participants (event_id, user_id, role, status)
VALUES ('52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000002', 'founder', 'active');

INSERT INTO public.pitches (id, user_id, hook, video_url, status, visibility, event_id)
VALUES
  ('53000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000002', 'Atomic pitch', 'https://example.test/atomic.mp4', 'published', 'public', NULL),
  ('53000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000002', 'Other event pitch', 'https://example.test/other.mp4', 'published', 'public', '52000000-0000-0000-0000-000000000002'),
  ('53000000-0000-0000-0000-000000000003', '51000000-0000-0000-0000-000000000002', 'Rollback pitch', 'https://example.test/rollback.mp4', 'published', 'public', NULL);

SELECT ok(
  to_regprocedure('public.submit_legacy_event_final_take_atomic(uuid,uuid)') IS NOT NULL,
  'atomic legacy event submission RPC exists'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.submit_legacy_event_final_take_atomic(uuid,uuid)', 'EXECUTE'),
  'anonymous callers cannot submit through the privileged RPC'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.submit_legacy_event_final_take_atomic(uuid,uuid)', 'EXECUTE'),
  'authenticated callers can submit through the RPC'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000002","email":"atomic-founder@example.test","role":"authenticated"}',
  true
);

SELECT is(
  public.submit_legacy_event_final_take_atomic(
    '52000000-0000-0000-0000-000000000001',
    '53000000-0000-0000-0000-000000000001'
  ) #>> '{visibility_changed}',
  'true',
  'first submission reports removal from the public feed'
);
SELECT is(
  (SELECT event_id FROM public.pitches WHERE id = '53000000-0000-0000-0000-000000000001'),
  '52000000-0000-0000-0000-000000000001'::uuid,
  'submission binds the pitch to the requested event'
);
SELECT is(
  (SELECT visibility FROM public.pitches WHERE id = '53000000-0000-0000-0000-000000000001'),
  'private',
  'submission makes the bound pitch private'
);
SELECT is(
  (SELECT status FROM public.pitch_event_submissions
   WHERE event_id = '52000000-0000-0000-0000-000000000001'
     AND user_id = '51000000-0000-0000-0000-000000000002'),
  'submitted',
  'submission row commits with the pitch binding'
);
SELECT lives_ok(
  $$ SELECT public.submit_legacy_event_final_take_atomic(
    '52000000-0000-0000-0000-000000000001',
    '53000000-0000-0000-0000-000000000001'
  ) $$,
  'replaying the same submission is idempotent'
);
SELECT is(
  (SELECT count(*)::integer FROM public.pitch_event_submissions
   WHERE event_id = '52000000-0000-0000-0000-000000000001'
     AND user_id = '51000000-0000-0000-0000-000000000002'),
  1,
  'idempotent replay does not create another submission'
);
SELECT throws_ok(
  $$ SELECT public.submit_legacy_event_final_take_atomic(
    '52000000-0000-0000-0000-000000000001',
    '53000000-0000-0000-0000-000000000002'
  ) $$,
  'P0001',
  'Pitch is already bound to another event',
  'a pitch cannot be submitted to a different event'
);
SELECT is(
  (SELECT event_id FROM public.pitches WHERE id = '53000000-0000-0000-0000-000000000002'),
  '52000000-0000-0000-0000-000000000002'::uuid,
  'rejected cross-event submission keeps the original binding'
);
SELECT is(
  (SELECT visibility FROM public.pitches WHERE id = '53000000-0000-0000-0000-000000000002'),
  'public',
  'rejected cross-event submission does not mutate visibility'
);
SELECT is(
  (SELECT pitch_id FROM public.pitch_event_submissions
   WHERE event_id = '52000000-0000-0000-0000-000000000001'
     AND user_id = '51000000-0000-0000-0000-000000000002'),
  '53000000-0000-0000-0000-000000000001'::uuid,
  'rejected cross-event submission does not replace the final take'
);

RESET ROLE;
CREATE FUNCTION public.reject_atomic_submission_for_test()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'forced submission failure';
END;
$$;
CREATE TRIGGER reject_atomic_submission_for_test
  BEFORE INSERT OR UPDATE ON public.pitch_event_submissions
  FOR EACH ROW EXECUTE FUNCTION public.reject_atomic_submission_for_test();

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000002","email":"atomic-founder@example.test","role":"authenticated"}',
  true
);
SELECT throws_ok(
  $$ SELECT public.submit_legacy_event_final_take_atomic(
    '52000000-0000-0000-0000-000000000001',
    '53000000-0000-0000-0000-000000000003'
  ) $$,
  'P0001',
  'forced submission failure',
  'a submission write failure aborts the RPC'
);
SELECT is(
  (SELECT event_id FROM public.pitches WHERE id = '53000000-0000-0000-0000-000000000003'),
  NULL::uuid,
  'failed submission rolls back event binding'
);
SELECT is(
  (SELECT visibility FROM public.pitches WHERE id = '53000000-0000-0000-0000-000000000003'),
  'public',
  'failed submission rolls back the privacy update'
);
SELECT is(
  (SELECT count(*)::integer FROM public.pitch_event_submissions
   WHERE pitch_id = '53000000-0000-0000-0000-000000000003'),
  0,
  'failed submission leaves no submission row'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
