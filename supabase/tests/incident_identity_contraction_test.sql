BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(14);

SELECT ok(
  NOT has_table_privilege('anon', 'public.review_assignments', 'SELECT'),
  'anonymous callers have no direct review-assignment read access'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.review_assignments', 'SELECT'),
  'authenticated callers have no direct review-assignment read access'
);
SELECT ok(
  NOT has_column_privilege('authenticated', 'public.review_assignments', 'reviewer_user_id', 'SELECT'),
  'authenticated callers cannot correlate reviewer identity directly'
);
SELECT ok(
  has_table_privilege('service_role', 'public.review_assignments', 'SELECT'),
  'service-role operational callers retain assignment audit access'
);
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.review_assignments'::regclass),
  true,
  'review assignments keep RLS enabled as defense in depth'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.get_review_queue_snapshot(integer,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.get_review_assignment_detail(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.get_event_review_assignments(uuid)', 'EXECUTE'),
  'authenticated callers retain fixed assignment projections'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.get_event_review_assignments(uuid)', 'EXECUTE'),
  'anonymous callers cannot execute the organizer assignment projection'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.get_review_assignment_event_identities(uuid[])', 'EXECUTE'),
  'anonymous callers cannot execute the assignment identity projection'
);
SELECT ok(
  pg_get_function_result('public.get_event_review_assignments(uuid)'::regprocedure)
    NOT LIKE '%reviewer_user_id%',
  'event assignment projection omits reviewer identity'
);
SELECT ok(
  NOT has_column_privilege('authenticated', 'public.feedback', 'user_id', 'SELECT'),
  'authenticated callers cannot directly read accountable feedback identity'
);
SELECT ok(
  NOT has_column_privilege('authenticated', 'public.feedback', 'reviewer_role', 'SELECT'),
  'authenticated callers cannot bypass feedback role disclosure'
);
SELECT ok(
  NOT has_column_privilege('authenticated', 'public.feedback', 'disclosure_mode', 'SELECT'),
  'authenticated callers cannot inspect reviewer anonymity choices'
);
SELECT ok(
  has_table_privilege('service_role', 'public.feedback', 'SELECT'),
  'service-role audit callers retain feedback access'
);
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.feedback'::regclass),
  true,
  'feedback keeps RLS enabled as defense in depth'
);

SELECT * FROM finish();
ROLLBACK;
