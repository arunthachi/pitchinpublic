BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(19);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data
) VALUES
  ('61000000-0000-0000-0000-000000000001', 'identity-founder@example.test', 'authenticated', 'authenticated', '', now(), '{}'::jsonb, '{"full_name":"Identity Founder"}'::jsonb),
  ('61000000-0000-0000-0000-000000000002', 'identity-reviewer@example.test', 'authenticated', 'authenticated', '', now(), '{}'::jsonb, '{"full_name":"Identity Reviewer"}'::jsonb),
  ('61000000-0000-0000-0000-000000000003', 'identity-organizer@example.test', 'authenticated', 'authenticated', '', now(), '{}'::jsonb, '{"full_name":"Identity Organizer"}'::jsonb),
  ('61000000-0000-0000-0000-000000000004', 'identity-admin@example.test', 'authenticated', 'authenticated', '', now(), '{}'::jsonb, '{"full_name":"Identity Admin"}'::jsonb),
  ('61000000-0000-0000-0000-000000000005', 'identity-outsider@example.test', 'authenticated', 'authenticated', '', now(), '{}'::jsonb, '{"full_name":"Identity Outsider"}'::jsonb),
  ('61000000-0000-0000-0000-000000000006', 'identity-dual@example.test', 'authenticated', 'authenticated', '', now(), '{}'::jsonb, '{"full_name":"Identity Dual Role"}'::jsonb);

INSERT INTO public.platform_admins(email, role)
VALUES ('identity-admin@example.test', 'super_admin');

INSERT INTO public.trusted_reviewer_memberships (
  id, user_id, reviewer_roles, expertise, title, organization
) VALUES (
  '66000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000002',
  ARRAY['investor'], ARRAY['private identity clue'],
  'Identity-sensitive title', 'Identity-sensitive organization'
);

INSERT INTO public.pitch_events (
  id, organizer_id, name, slug, event_date, status, visibility
) VALUES
  ('62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000003', 'Identity event', 'identity-event', current_date, 'active', 'public'),
  ('62000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000006', 'Dual-role event', 'identity-dual-event', current_date, 'active', 'public');

INSERT INTO public.pitches (
  id, user_id, hook, video_url, status, visibility, startup_name, event_id
) VALUES
  ('63000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', 'Anonymous event feedback', 'https://example.test/identity.mp4', 'published', 'public', 'Identity Target', '62000000-0000-0000-0000-000000000001'),
  ('63000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000006', 'Dual role feedback', 'https://example.test/identity-dual.mp4', 'published', 'public', 'Dual Target', '62000000-0000-0000-0000-000000000002');

INSERT INTO public.pitch_event_participants(event_id, user_id, role, status)
VALUES
  ('62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000002', 'judge', 'active'),
  ('62000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000002', 'judge', 'active');

INSERT INTO public.pitch_event_submissions(event_id, user_id, pitch_id, status, submitted_at)
VALUES
  ('62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', '63000000-0000-0000-0000-000000000001', 'submitted', now()),
  ('62000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000006', '63000000-0000-0000-0000-000000000002', 'submitted', now());

INSERT INTO public.trusted_reviewer_event_access(membership_id, event_id, granted_by)
VALUES (
  '66000000-0000-0000-0000-000000000001',
  '62000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000004'
);

INSERT INTO public.review_assignments(
  id, event_id, pitch_id, reviewer_user_id, status, reviewer_role, assignment_reason
) VALUES
  ('65000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', '63000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000002', 'pending', 'judge', 'identity_scope_test'),
  ('65000000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000002', '63000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000002', 'pending', 'judge', 'identity_dual_scope_test');

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000002","email":"identity-reviewer@example.test","role":"authenticated"}',
  true
);
INSERT INTO public.feedback (
  id, pitch_id, user_id, type, content, is_public, disclosure_mode, reviewer_role, review_assignment_id
) VALUES
  ('64000000-0000-0000-0000-000000000001', '63000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000002', 'toast', '{"notes":"Anonymous event feedback"}', true, 'anonymous_to_founder', 'judge', '65000000-0000-0000-0000-000000000001'),
  ('64000000-0000-0000-0000-000000000002', '63000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000002', 'toast', '{"notes":"Dual role feedback"}', true, 'anonymous_to_founder', 'judge', '65000000-0000-0000-0000-000000000002'),
  ('64000000-0000-0000-0000-000000000003', '63000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000002', 'toast', '{"notes":"Global feedback on event pitch"}', true, 'anonymous_to_founder', 'trusted_reviewer', NULL);
SELECT set_config('request.jwt.claims', '{}', true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000001","email":"identity-founder@example.test","role":"authenticated"}', true);
SELECT is((SELECT reviewer_label FROM public.get_founder_pitch_feedback(ARRAY['63000000-0000-0000-0000-000000000001'::uuid]) WHERE id = '64000000-0000-0000-0000-000000000001'), 'Anonymous reviewer', 'founder receives one non-linkable anonymous label');
SELECT is((SELECT user_id FROM public.get_founder_pitch_feedback(ARRAY['63000000-0000-0000-0000-000000000001'::uuid]) WHERE id = '64000000-0000-0000-0000-000000000001'), NULL::uuid, 'founder receives no reviewer id');
SELECT is((SELECT reviewer_role FROM public.get_founder_pitch_feedback(ARRAY['63000000-0000-0000-0000-000000000001'::uuid]) WHERE id = '64000000-0000-0000-0000-000000000001'), NULL::text, 'founder receives no reviewer role');
SELECT is((SELECT profiles FROM public.get_founder_pitch_feedback(ARRAY['63000000-0000-0000-0000-000000000001'::uuid]) WHERE id = '64000000-0000-0000-0000-000000000001'), NULL::jsonb, 'founder receives no reviewer profile');
SELECT is((SELECT reviewer_badge FROM public.get_founder_pitch_feedback(ARRAY['63000000-0000-0000-0000-000000000001'::uuid]) WHERE id = '64000000-0000-0000-0000-000000000001'), NULL::jsonb, 'founder receives no reviewer badge');

RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT is((SELECT reviewer_label FROM public.get_founder_pitch_feedback(ARRAY['63000000-0000-0000-0000-000000000001'::uuid]) WHERE id = '64000000-0000-0000-0000-000000000001'), 'Anonymous reviewer', 'anonymous viewer receives the same non-linkable label');
SELECT is((SELECT user_id FROM public.get_founder_pitch_feedback(ARRAY['63000000-0000-0000-0000-000000000001'::uuid]) WHERE id = '64000000-0000-0000-0000-000000000001'), NULL::uuid, 'anonymous viewer receives no reviewer id');

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000005","email":"identity-outsider@example.test","role":"authenticated"}', true);
SELECT is((SELECT reviewer_label FROM public.get_founder_pitch_feedback(ARRAY['63000000-0000-0000-0000-000000000001'::uuid]) WHERE id = '64000000-0000-0000-0000-000000000001'), 'Anonymous reviewer', 'unrelated viewer receives the same non-linkable label');
SELECT is((SELECT profiles FROM public.get_founder_pitch_feedback(ARRAY['63000000-0000-0000-0000-000000000001'::uuid]) WHERE id = '64000000-0000-0000-0000-000000000001'), NULL::jsonb, 'unrelated viewer receives no reviewer profile');

SELECT set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000002","email":"identity-reviewer@example.test","role":"authenticated"}', true);
SELECT is((SELECT user_id FROM public.get_founder_pitch_feedback(ARRAY['63000000-0000-0000-0000-000000000001'::uuid]) WHERE id = '64000000-0000-0000-0000-000000000001'), '61000000-0000-0000-0000-000000000002'::uuid, 'feedback author sees their own identity');
SELECT is((SELECT reviewer_label FROM public.get_founder_pitch_feedback(ARRAY['63000000-0000-0000-0000-000000000001'::uuid]) WHERE id = '64000000-0000-0000-0000-000000000001'), 'Identity Reviewer', 'feedback author sees their own named label');

SELECT set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000003","email":"identity-organizer@example.test","role":"authenticated"}', true);
SELECT is((SELECT user_id FROM public.get_founder_pitch_feedback(ARRAY['63000000-0000-0000-0000-000000000001'::uuid]) WHERE id = '64000000-0000-0000-0000-000000000001'), '61000000-0000-0000-0000-000000000002'::uuid, 'event organizer receives assignment-scoped accountability identity');
SELECT isnt((SELECT reviewer_badge FROM public.get_founder_pitch_feedback(ARRAY['63000000-0000-0000-0000-000000000001'::uuid]) WHERE id = '64000000-0000-0000-0000-000000000001'), NULL::jsonb, 'event organizer receives assignment-scoped accountability badge');
SELECT is((SELECT user_id FROM public.get_founder_pitch_feedback(ARRAY['63000000-0000-0000-0000-000000000001'::uuid]) WHERE id = '64000000-0000-0000-0000-000000000003'), NULL::uuid, 'event organizer cannot identify global feedback on the same pitch');
SELECT is((SELECT reviewer_label FROM public.get_founder_pitch_feedback(ARRAY['63000000-0000-0000-0000-000000000001'::uuid]) WHERE id = '64000000-0000-0000-0000-000000000003'), 'Anonymous reviewer', 'event organizer gets a non-linkable label for global feedback on the same pitch');
SELECT is((SELECT reviewer_badge FROM public.get_founder_pitch_feedback(ARRAY['63000000-0000-0000-0000-000000000001'::uuid]) WHERE id = '64000000-0000-0000-0000-000000000003'), NULL::jsonb, 'event organizer gets no identity-adjacent badge for global feedback');

SELECT set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000004","email":"identity-admin@example.test","role":"authenticated"}', true);
SELECT is((SELECT user_id FROM public.get_founder_pitch_feedback(ARRAY['63000000-0000-0000-0000-000000000001'::uuid]) WHERE id = '64000000-0000-0000-0000-000000000003'), '61000000-0000-0000-0000-000000000002'::uuid, 'platform administrator receives global accountability identity');

SELECT set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000006","email":"identity-dual@example.test","role":"authenticated"}', true);
SELECT is((SELECT user_id FROM public.get_founder_pitch_feedback(ARRAY['63000000-0000-0000-0000-000000000002'::uuid])), '61000000-0000-0000-0000-000000000002'::uuid, 'dual-role founder-organizer receives accountability identity');
SELECT is((SELECT reviewer_label FROM public.get_founder_pitch_feedback(ARRAY['63000000-0000-0000-0000-000000000002'::uuid])), 'Identity Reviewer', 'dual-role founder-organizer receives named label');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
