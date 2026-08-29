BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(17);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data
) VALUES
  ('10000000-0000-0000-0000-000000000001', 'owner@example.test', 'authenticated', 'authenticated', '', now(), '{}'::jsonb, '{"full_name":"Owner"}'::jsonb),
  ('10000000-0000-0000-0000-000000000002', 'reviewer@example.test', 'authenticated', 'authenticated', '', now(), '{}'::jsonb, '{"full_name":"Reviewer"}'::jsonb),
  ('10000000-0000-0000-0000-000000000003', 'outsider@example.test', 'authenticated', 'authenticated', '', now(), '{}'::jsonb, '{"full_name":"Outsider"}'::jsonb);

INSERT INTO public.pilot_members(user_id, source) VALUES
  ('10000000-0000-0000-0000-000000000001', 'manual'),
  ('10000000-0000-0000-0000-000000000002', 'manual');

INSERT INTO public.pitches (
  id, user_id, hook, video_url, status, visibility, startup_name
) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Public pitch', 'https://example.test/public.mp4', 'published', 'public', 'Public Co'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Private pitch', 'https://example.test/private.mp4', 'published', 'private', 'Private Co');

SELECT is(
  (SELECT pitches_count FROM public.profiles WHERE id = '10000000-0000-0000-0000-000000000001'),
  1,
  'only published public pitches increment the compatibility counter'
);

UPDATE public.pitches
SET visibility = 'public'
WHERE id = '20000000-0000-0000-0000-000000000002';

SELECT is(
  (SELECT pitches_count FROM public.profiles WHERE id = '10000000-0000-0000-0000-000000000001'),
  2,
  'a private-to-public transition increments the counter once'
);

DO $$
BEGIN
  PERFORM public.increment_user_pitches_count('10000000-0000-0000-0000-000000000001');
END;
$$;
SELECT is(
  (SELECT pitches_count FROM public.profiles WHERE id = '10000000-0000-0000-0000-000000000001'),
  2,
  'the legacy increment RPC is an idempotent compatibility shim'
);

UPDATE public.pitches
SET deleted_at = now()
WHERE id = '20000000-0000-0000-0000-000000000002';

SELECT is(
  (SELECT pitches_count FROM public.profiles WHERE id = '10000000-0000-0000-0000-000000000001'),
  1,
  'soft delete decrements the canonical public counter'
);

SELECT is(
  public.get_public_pitch_leaderboard(10, 0) #>> '{entries,0,pitches_count}',
  '1',
  'leaderboard derives the same canonical count'
);

INSERT INTO public.review_assignments (
  id, pitch_id, reviewer_user_id, status, reviewer_role, assignment_reason
) VALUES (
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  'pending', 'peer_founder', 'test_assignment'
);

UPDATE public.review_assignments
SET status = 'invalidated', invalidated_at = now(), invalidation_reason = 'test_invalidation'
WHERE id = '30000000-0000-0000-0000-000000000001';

SELECT is(
  (SELECT status FROM public.review_assignments WHERE id = '30000000-0000-0000-0000-000000000001'),
  'invalidated',
  'active assignments have an auditable invalidated terminal state'
);

INSERT INTO public.review_assignments (
  id, pitch_id, reviewer_user_id, status, reviewer_role, assignment_reason
) VALUES (
  '30000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  'pending', 'peer_founder', 'replacement_assignment'
);

SELECT is(
  (SELECT count(*)::integer FROM public.review_assignments
   WHERE pitch_id = '20000000-0000-0000-0000-000000000001'
     AND reviewer_user_id = '10000000-0000-0000-0000-000000000002'),
  2,
  'partial uniqueness permits replacement after invalidation while preserving history'
);

INSERT INTO public.feedback (
  id, pitch_id, user_id, type, content, is_public, disclosure_mode
) VALUES (
  '40000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  'toast', '{}', true, 'anonymous_to_founder'
);

UPDATE public.review_assignments
SET status = 'submitted',
    completed_feedback_id = '40000000-0000-0000-0000-000000000001'
WHERE id = '30000000-0000-0000-0000-000000000002';

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","email":"reviewer@example.test","role":"authenticated"}',
  true
);

SELECT is(
  (SELECT count(*)::integer FROM public.get_my_feedback_history(21, NULL, NULL)),
  1,
  'self history returns caller-authored feedback'
);

SELECT is(
  (SELECT feedback_id FROM public.get_my_feedback_history(21, NULL, NULL)),
  '40000000-0000-0000-0000-000000000001'::uuid,
  'self history returns the stable feedback id cursor component'
);

SELECT is(
  (public.get_review_queue_snapshot(3, 'founder') #>> '{pendingCount}')::integer,
  0,
  'queue snapshot excludes the submitted assignment'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","email":"owner@example.test","role":"authenticated"}',
  true
);

SELECT is(
  (SELECT user_id FROM public.get_founder_pitch_feedback(
    ARRAY['20000000-0000-0000-0000-000000000001'::uuid]
  ) WHERE id = '40000000-0000-0000-0000-000000000001'),
  NULL::uuid,
  'anonymous-to-founder projection removes reviewer identity'
);

SELECT is(
  (SELECT reviewer_role FROM public.get_founder_pitch_feedback(
    ARRAY['20000000-0000-0000-0000-000000000001'::uuid]
  ) WHERE id = '40000000-0000-0000-0000-000000000001'),
  NULL::text,
  'anonymous-to-founder projection removes role metadata'
);

SELECT is(
  public.can_rate_feedback('40000000-0000-0000-0000-000000000001') #>> '{reason}',
  'allowed',
  'pitch owner can rate feedback without reading feedback.user_id'
);

SELECT is(
  public.update_pitch_visibility_locked(
    '20000000-0000-0000-0000-000000000001', 'private'
  ) #>> '{visibility}',
  'private',
  'owner-scoped visibility RPC applies the eligibility-changing write'
);

RESET ROLE;
SELECT is(
  (SELECT status FROM public.review_assignments
   WHERE id = '30000000-0000-0000-0000-000000000002'),
  'submitted',
  'a submitted assignment remains immutable across later privacy changes'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","email":"outsider@example.test","role":"authenticated"}',
  true
);

SELECT is(
  public.can_rate_feedback('40000000-0000-0000-0000-000000000001') #>> '{reason}',
  'not_owner',
  'unrelated users cannot rate feedback'
);

SELECT is(
  (SELECT count(*)::integer FROM public.get_founder_pitch_feedback(
    ARRAY['20000000-0000-0000-0000-000000000001'::uuid]
  )),
  0,
  'caller-safe feedback projection does not reveal a private pitch to an outsider'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
