BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(8);

SELECT ok(
  has_column_privilege('authenticated', 'public.feedback', 'user_id', 'SELECT'),
  'PR1 preserves the previous application feedback identity read during cutover'
);
SELECT ok(
  has_column_privilege('authenticated', 'public.feedback', 'criterion_key', 'SELECT')
  AND has_column_privilege('authenticated', 'public.feedback', 'observation', 'SELECT')
  AND has_column_privilege('authenticated', 'public.feedback', 'next_step', 'SELECT')
  AND has_column_privilege('authenticated', 'public.feedback', 'disclosure_mode', 'SELECT'),
  'PR1 expands the previous application grant to structured feedback columns'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.review_assignments', 'SELECT'),
  'PR1 preserves previous application assignment reads until post-cutover PR2'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.review_assignments', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.review_assignments', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.review_assignments', 'DELETE'),
  'PR1 does not restore direct assignment mutation privileges'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.feedback', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.feedback', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.feedback', 'DELETE'),
  'PR1 keeps feedback mutation RPC-only'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.get_review_queue_snapshot(integer,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.get_review_assignment_detail(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.get_event_review_assignments(uuid)', 'EXECUTE'),
  'compatible application assignment projections are available before PR2'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.get_founder_pitch_feedback(uuid[])', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.get_my_feedback_history(integer,timestamp with time zone,uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.can_rate_feedback(uuid)', 'EXECUTE'),
  'compatible application feedback projections are available before PR2'
);
SELECT ok(
  has_table_privilege('service_role', 'public.feedback', 'SELECT')
  AND has_table_privilege('service_role', 'public.review_assignments', 'SELECT'),
  'service-role operations remain compatible throughout the rollout'
);

SELECT * FROM finish();
ROLLBACK;
