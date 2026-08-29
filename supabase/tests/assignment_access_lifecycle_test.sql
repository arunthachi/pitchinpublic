BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(44);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data
) VALUES
  ('61000000-0000-0000-0000-000000000001', 'lifecycle-admin@example.test', 'authenticated', 'authenticated', '', now(), '{}'::jsonb, '{"full_name":"Lifecycle Admin"}'::jsonb),
  ('61000000-0000-0000-0000-000000000002', 'lifecycle-organizer@example.test', 'authenticated', 'authenticated', '', now(), '{}'::jsonb, '{"full_name":"Lifecycle Organizer"}'::jsonb),
  ('61000000-0000-0000-0000-000000000003', 'lifecycle-founder@example.test', 'authenticated', 'authenticated', '', now(), '{}'::jsonb, '{"full_name":"Lifecycle Founder"}'::jsonb),
  ('61000000-0000-0000-0000-000000000004', 'lifecycle-trusted@example.test', 'authenticated', 'authenticated', '', now(), '{}'::jsonb, '{"full_name":"Lifecycle Trusted"}'::jsonb),
  ('61000000-0000-0000-0000-000000000005', 'lifecycle-participant@example.test', 'authenticated', 'authenticated', '', now(), '{}'::jsonb, '{"full_name":"Lifecycle Participant"}'::jsonb),
  ('61000000-0000-0000-0000-000000000006', 'lifecycle-submission-reviewer@example.test', 'authenticated', 'authenticated', '', now(), '{}'::jsonb, '{"full_name":"Lifecycle Submission Reviewer"}'::jsonb),
  ('61000000-0000-0000-0000-000000000007', 'lifecycle-trusted-only@example.test', 'authenticated', 'authenticated', '', now(), '{}'::jsonb, '{"full_name":"Lifecycle Trusted Only"}'::jsonb);

INSERT INTO public.platform_admins(email, role)
VALUES ('lifecycle-admin@example.test', 'super_admin');

INSERT INTO public.pilot_members(user_id, source) VALUES
  ('61000000-0000-0000-0000-000000000003', 'manual'),
  ('61000000-0000-0000-0000-000000000004', 'manual'),
  ('61000000-0000-0000-0000-000000000005', 'manual'),
  ('61000000-0000-0000-0000-000000000006', 'manual');

INSERT INTO public.pitch_events(id, organizer_id, name, slug, event_date, status)
VALUES
  ('62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000002', 'Access event', 'lifecycle-access', current_date, 'active'),
  ('62000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000002', 'Participant event', 'lifecycle-participant', current_date, 'active'),
  ('62000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000002', 'Submission event', 'lifecycle-submission', current_date, 'active'),
  ('62000000-0000-0000-0000-000000000004', '61000000-0000-0000-0000-000000000002', 'Alternate access event', 'lifecycle-alternate', current_date, 'active');

INSERT INTO public.pitch_event_participants(id, event_id, user_id, role, status)
VALUES
  ('63000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000003', 'founder', 'active'),
  ('63000000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000003', 'founder', 'active'),
  ('63000000-0000-0000-0000-000000000003', '62000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000005', 'coach', 'active'),
  ('63000000-0000-0000-0000-000000000004', '62000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000003', 'founder', 'active'),
  ('63000000-0000-0000-0000-000000000005', '62000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000006', 'judge', 'active'),
  ('63000000-0000-0000-0000-000000000006', '62000000-0000-0000-0000-000000000004', '61000000-0000-0000-0000-000000000003', 'founder', 'active');

INSERT INTO public.pitches(id, user_id, hook, video_url, status, visibility, event_id)
VALUES
  ('64000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000003', 'Trusted event pitch', 'https://example.test/lifecycle-1.mp4', 'published', 'private', '62000000-0000-0000-0000-000000000001'),
  ('64000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000003', 'Trusted global pitch', 'https://example.test/lifecycle-2.mp4', 'published', 'public', NULL),
  ('64000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000003', 'Participant pitch', 'https://example.test/lifecycle-3.mp4', 'published', 'private', '62000000-0000-0000-0000-000000000002'),
  ('64000000-0000-0000-0000-000000000004', '61000000-0000-0000-0000-000000000003', 'Submission pitch', 'https://example.test/lifecycle-4.mp4', 'published', 'private', '62000000-0000-0000-0000-000000000003'),
  ('64000000-0000-0000-0000-000000000005', '61000000-0000-0000-0000-000000000003', 'Alternate access pitch', 'https://example.test/lifecycle-5.mp4', 'published', 'private', '62000000-0000-0000-0000-000000000004');

INSERT INTO public.pitch_event_submissions(id, event_id, user_id, pitch_id, status)
VALUES
  ('65000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000003', '64000000-0000-0000-0000-000000000001', 'submitted'),
  ('65000000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000003', '64000000-0000-0000-0000-000000000003', 'submitted'),
  ('65000000-0000-0000-0000-000000000003', '62000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000003', '64000000-0000-0000-0000-000000000004', 'submitted'),
  ('65000000-0000-0000-0000-000000000004', '62000000-0000-0000-0000-000000000004', '61000000-0000-0000-0000-000000000003', '64000000-0000-0000-0000-000000000005', 'submitted');

INSERT INTO public.trusted_reviewer_memberships(id, user_id, reviewer_roles, expertise)
VALUES
  ('66000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000004', ARRAY['investor'], ARRAY['lifecycle']),
  ('66000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000007', ARRAY['mentor'], ARRAY['trusted-only']);

INSERT INTO public.trusted_reviewer_event_access(id, membership_id, event_id, granted_by)
VALUES
  ('67000000-0000-0000-0000-000000000001', '66000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001'),
  ('67000000-0000-0000-0000-000000000002', '66000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000004', '61000000-0000-0000-0000-000000000001');

INSERT INTO public.review_assignments(id, pitch_id, reviewer_user_id, event_id, status, reviewer_role, assignment_reason)
VALUES
  ('68000000-0000-0000-0000-000000000001', '64000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000004', '62000000-0000-0000-0000-000000000001', 'pending', 'trusted_reviewer', 'trusted_event'),
  ('68000000-0000-0000-0000-000000000002', '64000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000004', NULL, 'pending', 'trusted_reviewer', 'trusted_global'),
  ('68000000-0000-0000-0000-000000000003', '64000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000005', '62000000-0000-0000-0000-000000000002', 'pending', 'coach', 'participant_access'),
  ('68000000-0000-0000-0000-000000000004', '64000000-0000-0000-0000-000000000004', '61000000-0000-0000-0000-000000000006', '62000000-0000-0000-0000-000000000003', 'started', 'judge', 'submission_access'),
  ('68000000-0000-0000-0000-000000000005', '64000000-0000-0000-0000-000000000005', '61000000-0000-0000-0000-000000000004', '62000000-0000-0000-0000-000000000004', 'pending', 'trusted_reviewer', 'alternate_access'),
  ('68000000-0000-0000-0000-000000000006', '64000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000007', NULL, 'pending', 'trusted_reviewer', 'trusted_only_global');

-- Add alternate participant access only after the assignment has captured its
-- trusted-reviewer role. This makes later reclassification assertions capable
-- of failing if the membership-revoke RPC stops rewriting the queue role.
INSERT INTO public.pitch_event_participants(id, event_id, user_id, role, status)
VALUES ('63000000-0000-0000-0000-000000000007', '62000000-0000-0000-0000-000000000004', '61000000-0000-0000-0000-000000000004', 'mentor', 'active');

SELECT is((SELECT reviewer_role FROM public.review_assignments WHERE id = '68000000-0000-0000-0000-000000000005'), 'trusted_reviewer', 'alternate-access fixture starts in trusted-reviewer queue mode');

SELECT ok(to_regprocedure('public.revoke_trusted_reviewer_event_access_locked(uuid,uuid)') IS NOT NULL, 'event-access lifecycle RPC exists');
SELECT ok(to_regprocedure('public.revoke_trusted_reviewer_membership_locked(uuid)') IS NOT NULL, 'membership lifecycle RPC exists');
SELECT ok(to_regprocedure('public.update_event_participant_locked(uuid,uuid,text,text)') IS NOT NULL, 'participant lifecycle RPC exists');
SELECT ok(to_regprocedure('public.delete_my_event_submission_locked(uuid)') IS NOT NULL, 'submission lifecycle RPC exists');
SELECT ok(NOT has_function_privilege('anon', 'public.revoke_trusted_reviewer_membership_locked(uuid)', 'EXECUTE'), 'anonymous cannot revoke reviewer membership');
SELECT ok(has_function_privilege('authenticated', 'public.revoke_trusted_reviewer_membership_locked(uuid)', 'EXECUTE'), 'authenticated callers reach the checked membership RPC');
SELECT ok((SELECT proconfig @> ARRAY['search_path=pg_catalog'] FROM pg_proc WHERE oid = 'public.revoke_trusted_reviewer_membership_locked(uuid)'::regprocedure), 'membership RPC pins search_path');
SELECT ok((SELECT proconfig @> ARRAY['search_path=pg_catalog'] FROM pg_proc WHERE oid = 'public.update_event_participant_locked(uuid,uuid,text,text)'::regprocedure), 'participant RPC pins search_path');
SELECT ok(pg_get_functiondef('public.submit_event_pitch_feedback(uuid,text,text,uuid,uuid)'::regprocedure) LIKE '%FOR UPDATE;%NOT public.is_review_assignment_eligible(matched_assignment.id)%', 'feedback submission rechecks eligibility after taking the assignment lock');
SELECT ok(
  strpos(pg_get_functiondef('public.get_review_assignment_detail(uuid)'::regprocedure), 'FROM public.pitches AS pitch')
    < strpos(pg_get_functiondef('public.get_review_assignment_detail(uuid)'::regprocedure), 'SELECT assignment.* INTO assignment_row'),
  'assignment detail locks the pitch before re-reading and locking the assignment'
);
SELECT ok(pg_get_functiondef('public.revoke_trusted_reviewer_event_access_locked(uuid,uuid)'::regprocedure) NOT LIKE '%DELETE FROM public.review_assignments%', 'event-access revocation never deletes assignment history');
SELECT ok(pg_get_functiondef('public.revoke_trusted_reviewer_membership_locked(uuid)'::regprocedure) NOT LIKE '%DELETE FROM public.review_assignments%', 'membership revocation never deletes assignment history');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000003","email":"lifecycle-founder@example.test","role":"authenticated"}', true);
SELECT throws_ok(
  $$SELECT public.revoke_trusted_reviewer_membership_locked('66000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Platform super admin access required',
  'non-admin cannot revoke reviewer membership'
);

SELECT set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000004","email":"lifecycle-trusted@example.test","role":"authenticated"}', true);
SELECT is(public.is_review_assignment_eligible('68000000-0000-0000-0000-000000000002'), true, 'active trusted membership keeps a global trusted assignment eligible');

SELECT set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000007","email":"lifecycle-trusted-only@example.test","role":"authenticated"}', true);
SELECT is(public.is_review_assignment_eligible('68000000-0000-0000-0000-000000000006'), true, 'trusted membership alone is a caller-independent pilot access path');

SELECT set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000001","email":"lifecycle-admin@example.test","role":"authenticated"}', true);
SELECT is(public.revoke_trusted_reviewer_event_access_locked('66000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001') #>> '{invalidated_assignments}', '1', 'event-access revoke invalidates unfinished event assignments');

RESET ROLE;
SELECT is((SELECT status FROM public.review_assignments WHERE id = '68000000-0000-0000-0000-000000000001'), 'invalidated', 'event assignment becomes terminal invalidated');
SELECT is((SELECT invalidation_reason FROM public.review_assignments WHERE id = '68000000-0000-0000-0000-000000000001'), 'trusted_event_access_revoked', 'event assignment records the revoke reason');
SELECT is((SELECT count(*)::integer FROM public.review_assignments WHERE id = '68000000-0000-0000-0000-000000000001'), 1, 'event assignment history remains present');
SELECT is((SELECT count(*)::integer FROM public.trusted_reviewer_event_access WHERE id = '67000000-0000-0000-0000-000000000001'), 0, 'event grant is removed in the same transaction');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000001","email":"lifecycle-admin@example.test","role":"authenticated"}', true);
SELECT is(public.revoke_trusted_reviewer_event_access_locked('66000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000004') #>> '{invalidated_assignments}', '0', 'event-grant revoke preserves assignments with active participant access');

RESET ROLE;
SELECT is((SELECT status FROM public.review_assignments WHERE id = '68000000-0000-0000-0000-000000000005'), 'pending', 'alternate participant access keeps the event assignment actionable');
SELECT is((SELECT reviewer_role FROM public.review_assignments WHERE id = '68000000-0000-0000-0000-000000000005'), 'trusted_reviewer', 'event-grant revoke keeps trusted queue role while membership remains active');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000004","email":"lifecycle-trusted@example.test","role":"authenticated"}', true);
SELECT is(
  (
    SELECT count(*)::integer
    FROM jsonb_array_elements(public.get_review_queue_snapshot(3, 'reviewer')->'assignments') AS queued(assignment)
    WHERE queued.assignment->>'public_id' = (
      SELECT public_id
      FROM public.pitches
      WHERE id = '64000000-0000-0000-0000-000000000005'
    )
  ),
  1,
  'event-grant revoke leaves alternate-access work reachable in trusted queue mode'
);

SELECT set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000001","email":"lifecycle-admin@example.test","role":"authenticated"}', true);
SELECT is(public.revoke_trusted_reviewer_membership_locked('66000000-0000-0000-0000-000000000001') #>> '{invalidated_assignments}', '1', 'membership revoke invalidates remaining unfinished assignments');

RESET ROLE;
SELECT is((SELECT status FROM public.trusted_reviewer_memberships WHERE id = '66000000-0000-0000-0000-000000000001'), 'revoked', 'membership is revoked atomically');
SELECT is((SELECT status FROM public.review_assignments WHERE id = '68000000-0000-0000-0000-000000000002'), 'invalidated', 'global trusted assignment is invalidated on membership revoke');
SELECT is((SELECT count(*)::integer FROM public.review_assignments WHERE id = '68000000-0000-0000-0000-000000000002'), 1, 'global assignment history remains present');
SELECT is((SELECT status FROM public.review_assignments WHERE id = '68000000-0000-0000-0000-000000000005'), 'pending', 'membership revoke preserves an event assignment backed by active participation');
SELECT is((SELECT reviewer_role FROM public.review_assignments WHERE id = '68000000-0000-0000-0000-000000000005'), 'mentor', 'preserved participant assignment is reclassified out of trusted-only queue mode');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000004","email":"lifecycle-trusted@example.test","role":"authenticated"}', true);
SELECT is(public.get_review_queue_snapshot(3, 'founder') #>> '{assignments,0,public_id}', (SELECT public_id FROM public.pitches WHERE id = '64000000-0000-0000-0000-000000000005'), 'reclassified assignment remains reachable in the founder queue');

SELECT set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000004","email":"lifecycle-trusted@example.test","role":"authenticated"}', true);
SELECT is(public.is_review_assignment_eligible('68000000-0000-0000-0000-000000000002'), false, 'revoked membership cannot keep a trusted assignment eligible');

RESET ROLE;
SELECT lives_ok(
  $$INSERT INTO public.review_assignments(pitch_id, reviewer_user_id, status, reviewer_role, assignment_reason)
    VALUES ('64000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000004', 'pending', 'public_reviewer', 'replacement_after_revoke')$$,
  'invalidated history does not block a replacement assignment'
);
SELECT is((SELECT count(*)::integer FROM public.review_assignments WHERE pitch_id = '64000000-0000-0000-0000-000000000002' AND reviewer_user_id = '61000000-0000-0000-0000-000000000004'), 2, 'replacement and invalidated history coexist');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000002","email":"lifecycle-organizer@example.test","role":"authenticated"}', true);
SELECT is(public.update_event_participant_locked('62000000-0000-0000-0000-000000000002', '63000000-0000-0000-0000-000000000003', 'judge', NULL) #>> '{invalidated_assignments}', '0', 'eligible participant role changes preserve unfinished assignments');
SELECT is((SELECT status FROM public.review_assignments WHERE id = '68000000-0000-0000-0000-000000000003'), 'pending', 'role change leaves an eligible assignment actionable');
SELECT is((SELECT reviewer_role FROM public.review_assignments WHERE id = '68000000-0000-0000-0000-000000000003'), 'judge', 'role change reclassifies the preserved assignment for the correct queue');
SELECT is(public.update_event_participant_locked('62000000-0000-0000-0000-000000000002', '63000000-0000-0000-0000-000000000003', NULL, 'removed') #>> '{invalidated_assignments}', '1', 'participant removal invalidates unfinished event assignments');

RESET ROLE;
SELECT is((SELECT status FROM public.pitch_event_participants WHERE id = '63000000-0000-0000-0000-000000000003'), 'removed', 'participant status changes atomically');
SELECT is((SELECT status FROM public.review_assignments WHERE id = '68000000-0000-0000-0000-000000000003'), 'invalidated', 'participant assignment history becomes invalidated');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000003","email":"lifecycle-founder@example.test","role":"authenticated"}', true);
SELECT is(public.delete_my_event_submission_locked('62000000-0000-0000-0000-000000000003') #>> '{invalidated_assignments}', '1', 'submission deletion invalidates unfinished pitch assignments');

RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.pitch_event_submissions WHERE id = '65000000-0000-0000-0000-000000000003'), 0, 'submission is removed atomically');
SELECT is((SELECT status FROM public.review_assignments WHERE id = '68000000-0000-0000-0000-000000000004'), 'invalidated', 'submission assignment history becomes invalidated');

SELECT * FROM finish();
ROLLBACK;
