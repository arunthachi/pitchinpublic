BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(18);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data
) VALUES
  ('51000000-0000-0000-0000-000000000001', 'followup-owner@example.test', 'authenticated', 'authenticated', '', now(), '{}'::jsonb, '{"full_name":"Followup Owner"}'::jsonb),
  ('51000000-0000-0000-0000-000000000002', 'followup-reviewer@example.test', 'authenticated', 'authenticated', '', now(), '{}'::jsonb, '{"full_name":"Followup Reviewer"}'::jsonb),
  ('51000000-0000-0000-0000-000000000003', 'queue-reviewer@example.test', 'authenticated', 'authenticated', '', now(), '{}'::jsonb, '{"full_name":"Queue Reviewer"}'::jsonb);

INSERT INTO public.pilot_members(user_id, source) VALUES
  ('51000000-0000-0000-0000-000000000001', 'manual'),
  ('51000000-0000-0000-0000-000000000002', 'manual'),
  ('51000000-0000-0000-0000-000000000003', 'manual');

INSERT INTO public.trusted_reviewer_memberships (
  user_id, reviewer_roles, expertise, title, organization
) VALUES
  (
    '51000000-0000-0000-0000-000000000002',
    ARRAY['investor'], ARRAY['identity-sensitive specialty'],
    'Identifying title', 'Identifying organization'
  ),
  (
    '51000000-0000-0000-0000-000000000003',
    ARRAY['investor'], ARRAY['queue testing'],
    'Queue reviewer', 'Test organization'
  );

INSERT INTO public.pitches (
  id, user_id, hook, video_url, status, visibility, startup_name
) VALUES
  ('52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'Public feedback target', 'https://example.test/followup-public.mp4', 'published', 'public', 'Public Target'),
  ('52000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', 'Private feedback target', 'https://example.test/followup-private.mp4', 'published', 'private', 'Private Target'),
  ('52000000-0000-0000-0000-000000000003', '51000000-0000-0000-0000-000000000001', 'First replacement target', 'https://example.test/followup-claim-one.mp4', 'published', 'public', 'Claim One'),
  ('52000000-0000-0000-0000-000000000004', '51000000-0000-0000-0000-000000000001', 'Second replacement target', 'https://example.test/followup-claim-two.mp4', 'published', 'public', 'Claim Two'),
  ('52000000-0000-0000-0000-000000000005', '51000000-0000-0000-0000-000000000001', 'Role-only target', 'https://example.test/followup-role.mp4', 'published', 'public', 'Role Target'),
  ('52000000-0000-0000-0000-000000000006', '51000000-0000-0000-0000-000000000001', 'Queue detail target', 'https://example.test/followup-queue.mp4', 'published', 'public', 'Queue Target');

INSERT INTO public.review_assignments (
  pitch_id, reviewer_user_id, status, reviewer_role, assignment_reason
) VALUES
  ('52000000-0000-0000-0000-000000000003', '51000000-0000-0000-0000-000000000002', 'pending', 'trusted_reviewer', 'stale_claim_one'),
  ('52000000-0000-0000-0000-000000000004', '51000000-0000-0000-0000-000000000002', 'pending', 'trusted_reviewer', 'stale_claim_two'),
  ('52000000-0000-0000-0000-000000000006', '51000000-0000-0000-0000-000000000003', 'pending', 'trusted_reviewer', 'queue_detail_fixture');

UPDATE public.review_assignments
SET status = 'invalidated',
    invalidated_at = now(),
    invalidation_reason = 'fixture_access_changed'
WHERE reviewer_user_id = '51000000-0000-0000-0000-000000000002'
  AND pitch_id IN (
    '52000000-0000-0000-0000-000000000003',
    '52000000-0000-0000-0000-000000000004'
  );

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000003","email":"queue-reviewer@example.test","role":"authenticated"}',
  true
);

SELECT is(
  (public.get_review_queue_snapshot(3, 'reviewer') #>> '{pendingCount}')::integer,
  1,
  'reviewer queue snapshot counts the actionable assignment'
);

SELECT is(
  public.get_review_queue_snapshot(3, 'reviewer') #>> '{assignments,0,public_id}',
  (SELECT public_id FROM public.pitches WHERE id = '52000000-0000-0000-0000-000000000006'),
  'reviewer queue snapshot returns the assigned public pitch identifier'
);

SELECT is(
  public.get_review_assignment_detail(
    (SELECT id FROM public.review_assignments
     WHERE pitch_id = '52000000-0000-0000-0000-000000000006'
       AND reviewer_user_id = '51000000-0000-0000-0000-000000000003')
  ) #>> '{available}',
  'true',
  'assignment detail opens an actionable caller-owned assignment'
);

SELECT is(
  (SELECT status FROM public.review_assignments
   WHERE pitch_id = '52000000-0000-0000-0000-000000000006'
     AND reviewer_user_id = '51000000-0000-0000-0000-000000000003'),
  'started',
  'opening assignment detail marks a pending assignment started'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000002","email":"followup-reviewer@example.test","role":"authenticated"}',
  true
);

SELECT is(
  public.can_view_pitch('52000000-0000-0000-0000-000000000002'),
  false,
  'reviewer cannot view the private UUID used by the direct feedback test'
);

SELECT throws_ok(
  $$SELECT * FROM public.submit_pitch_feedback(
    '52000000-0000-0000-0000-000000000002',
    'toast',
    '{"notes":"Useful","readiness":2,"signals":["clear"],"scores":{"clarity":5,"solution":5,"market":5,"presentation":5}}',
    '54000000-0000-0000-0000-000000000001'
  )$$,
  'Pitch not found',
  'direct feedback rejects a stale private pitch UUID'
);

SELECT lives_ok(
  $$SELECT * FROM public.submit_pitch_feedback(
    '52000000-0000-0000-0000-000000000001',
    'toast',
    '{"notes":"Useful","readiness":2,"signals":["clear"],"scores":{"clarity":5,"solution":5,"market":5,"presentation":5}}',
    '54000000-0000-0000-0000-000000000002'
  )$$,
  'direct feedback preserves intended public-pitch submissions'
);

SELECT lives_ok(
  $$SELECT * FROM public.submit_pitch_feedback(
    '52000000-0000-0000-0000-000000000005',
    'toast',
    '{"notes":"Role-only","readiness":2,"signals":["clear"],"scores":{"clarity":5,"solution":5,"market":5,"presentation":5}}',
    '54000000-0000-0000-0000-000000000003'
  )$$,
  'trusted reviewer can submit role-only feedback on a public pitch'
);

SELECT is(
  (SELECT count(*)::integer FROM public.claim_global_review_assignments(1)),
  1,
  'global claim replaces one invalidated historical assignment'
);

SELECT is(
  (SELECT count(*)::integer FROM public.claim_trusted_review_assignments(2)),
  1,
  'trusted claim also replaces an invalidated historical assignment'
);

RESET ROLE;
SELECT is(
  (SELECT count(*)::integer
   FROM public.review_assignments
   WHERE pitch_id IN (
     '52000000-0000-0000-0000-000000000003',
     '52000000-0000-0000-0000-000000000004'
   )),
  4,
  'claim paths preserve both invalidated rows and create two active replacements'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000001","email":"followup-owner@example.test","role":"authenticated"}',
  true
);

SELECT is(
  (SELECT user_id FROM public.get_founder_pitch_feedback(
    ARRAY['52000000-0000-0000-0000-000000000005'::uuid]
  )),
  NULL::uuid,
  'role-only feedback does not disclose reviewer identity to the founder'
);

SELECT is(
  (SELECT profiles FROM public.get_founder_pitch_feedback(
    ARRAY['52000000-0000-0000-0000-000000000005'::uuid]
  )),
  NULL::jsonb,
  'role-only feedback does not disclose reviewer profile data'
);

SELECT is(
  (SELECT reviewer_badge FROM public.get_founder_pitch_feedback(
    ARRAY['52000000-0000-0000-0000-000000000005'::uuid]
  )),
  NULL::jsonb,
  'role-only feedback does not disclose trusted badge identity clues'
);

SELECT is(
  public.update_pitch_visibility_locked(
    '52000000-0000-0000-0000-000000000006', 'private'
  ) #>> '{invalidated_assignments}',
  '1',
  'making the queue pitch private invalidates its active assignment atomically'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000003","email":"queue-reviewer@example.test","role":"authenticated"}',
  true
);

SELECT is(
  public.get_review_assignment_detail(
    (SELECT id FROM public.review_assignments
     WHERE pitch_id = '52000000-0000-0000-0000-000000000006'
       AND reviewer_user_id = '51000000-0000-0000-0000-000000000003')
  ) #>> '{status}',
  'invalidated',
  'assignment detail returns invalidated after eligibility changes'
);

SELECT lives_ok(
  $$SELECT count(*) FROM public.get_founder_pitch_feedback(
    array_fill('52000000-0000-0000-0000-000000000005'::uuid, ARRAY[100])
  )$$,
  'feedback projection accepts the caller batch size of 100'
);

SELECT throws_ok(
  $$SELECT count(*) FROM public.get_founder_pitch_feedback(
    array_fill('52000000-0000-0000-0000-000000000005'::uuid, ARRAY[101])
  )$$,
  'target_pitch_ids must contain between 1 and 100 pitches',
  'feedback projection keeps a bounded maximum above the caller contract'
);

SELECT * FROM finish();
ROLLBACK;
