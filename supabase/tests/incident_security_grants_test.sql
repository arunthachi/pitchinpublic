BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(23);

SELECT ok(
  to_regprocedure('public.get_review_queue_snapshot(integer,text)') IS NOT NULL,
  'atomic review queue snapshot RPC exists'
);
SELECT ok(
  to_regprocedure('public.get_review_assignment_detail(uuid)') IS NOT NULL,
  'locked review assignment detail RPC exists'
);
SELECT ok(
  to_regprocedure('public.get_public_pitch_leaderboard(integer,integer)') IS NOT NULL,
  'canonical leaderboard RPC exists'
);
SELECT ok(
  to_regprocedure('public.get_my_feedback_history(integer,timestamp with time zone,uuid)') IS NOT NULL,
  'self feedback history RPC exists'
);
SELECT ok(
  to_regprocedure('public.get_founder_pitch_feedback(uuid[])') IS NOT NULL,
  'caller-safe feedback projection RPC exists'
);
SELECT ok(
  to_regprocedure('public.can_rate_feedback(uuid)') IS NOT NULL,
  'quality authorization RPC exists'
);
SELECT ok(
  pg_get_functiondef(
    'public.submit_structured_event_pitch_feedback(uuid,text,text,uuid,uuid,text,text,text)'::regprocedure
  ) LIKE '%FOR SHARE%',
  'structured feedback submission takes the pitch lock before assignment work'
);

SELECT ok(
  has_function_privilege('anon', 'public.get_founder_pitch_feedback(uuid[])', 'EXECUTE'),
  'anonymous callers can use the disclosure-safe public feedback projection'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.get_my_feedback_history(integer,timestamp with time zone,uuid)', 'EXECUTE'),
  'anonymous callers cannot read self feedback history'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.feedback', 'SELECT'),
  'authenticated has no table-level feedback SELECT grant'
);
SELECT ok(
  has_column_privilege('authenticated', 'public.feedback', 'user_id', 'SELECT'),
  'PR1 preserves previous-application reviewer identity reads until post-cutover PR2'
);
SELECT ok(
  has_column_privilege('authenticated', 'public.feedback', 'reviewer_role', 'SELECT'),
  'PR1 preserves previous-application reviewer role reads until post-cutover PR2'
);
SELECT ok(
  has_column_privilege('authenticated', 'public.feedback', 'disclosure_mode', 'SELECT'),
  'PR1 expands disclosure-mode compatibility before the application cutover'
);
SELECT ok(
  has_column_privilege('authenticated', 'public.feedback', 'criterion_key', 'SELECT'),
  'authenticated retains direct structured-field compatibility access'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc AS procedure
    CROSS JOIN LATERAL aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) AS privilege
    WHERE procedure.oid = 'public.get_review_queue_snapshot(integer,text)'::regprocedure
      AND privilege.grantee = 0
      AND privilege.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute the privileged queue RPC'
);

SELECT is(
  (SELECT prosecdef FROM pg_proc
   WHERE oid = 'public.get_review_queue_snapshot(integer,text)'::regprocedure),
  true,
  'queue RPC is SECURITY DEFINER'
);
SELECT ok(
  (SELECT proconfig @> ARRAY['search_path=pg_catalog']
   FROM pg_proc
   WHERE oid = 'public.get_review_queue_snapshot(integer,text)'::regprocedure),
  'queue RPC pins its search_path'
);
SELECT ok(
  pg_get_functiondef(
    'public.submit_pitch_feedback(uuid,text,text,uuid)'::regprocedure
  ) LIKE '%pitch.visibility = ''public''%can_view_pitch(pitch.id)%',
  'direct feedback RPC enforces public visibility and caller view authorization'
);
SELECT ok(
  pg_get_functiondef(
    'public.claim_global_review_assignments(integer,timestamp with time zone)'::regprocedure
  ) LIKE '%existing.status <> ''invalidated''%'
  AND pg_get_functiondef(
    'public.claim_trusted_review_assignments(integer,timestamp with time zone)'::regprocedure
  ) LIKE '%existing.status <> ''invalidated''%',
  'both claim functions ignore invalidated historical assignments'
);
SELECT is(
  (SELECT relrowsecurity FROM pg_class
   WHERE oid = 'public.feedback'::regclass),
  true,
  'feedback keeps RLS enabled'
);
SELECT is(
  (SELECT relrowsecurity FROM pg_class
   WHERE oid = 'public.review_assignments'::regclass),
  true,
  'review assignments keep RLS enabled'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_review_assignments_unique_global_review'
      AND indexdef LIKE '%status <>%invalidated%'
  ),
  'global assignment uniqueness excludes invalidated audit rows'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.review_assignments'::regclass
      AND conname = 'review_assignments_status_check'
      AND pg_get_constraintdef(oid) LIKE '%invalidated%'
  ),
  'assignment status constraint recognizes invalidated as terminal'
);

SELECT * FROM finish();
ROLLBACK;
