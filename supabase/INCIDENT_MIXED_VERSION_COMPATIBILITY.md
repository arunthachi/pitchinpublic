# Incident migration compatibility and rollback

The incident release uses two pull requests so database privilege contraction
cannot overtake the compatible application. It is a forward-only
expand-contract rollout and has no destructive down migrations.

## Release status

The expand and contract stages are complete in staging and production. Release
`0.2.5` added the forward-only migration
`20260829183000_complete_review_assignment_pitch_contract.sql` after the
contract stage. It restores the full pitch rendering contract for assigned
reviews without reopening direct feedback or assignment identity access.

The 0.2.5 application and migration were verified in staging before production.
Production verification opened an existing assigned review, rendered the
feedback dialog, and completed a 10-minute canary without new console errors.

## PR1: expand and cut over the application

PR1 contains the compatible application and these additive migrations, in
filename order:

1. `20260829000021_add_incident_database_contracts.sql` adds safe feedback,
   history, leaderboard, queue, and assignment-detail RPCs. It temporarily
   extends the legacy feedback column grant for structured feedback.
2. `20260829002326_make_event_submission_atomic.sql` adds the atomic legacy
   event final-take RPC required by the compatible application. Its submission
   trigger also binds and privatizes an unbound pitch inside the previous
   application's exact upsert, before that upsert returns. The same invariant
   applies to trusted PostgreSQL and service-role backfills without requiring a
   user JWT.
3. `20260829002403_harden_incident_contracts_review_followup.sql` hardens
   submission and disclosure behavior without contracting browser table grants.
4. `20260829002500_preserve_assignment_history_on_access_changes.sql` keeps
   submitted assignment history while reconciling active access changes.

In staging, apply all PR1 expand migrations while the previous application is
still live. Then deploy and verify the compatible application. In production,
again apply all PR1 expand migrations while the previous application is still
live. Only after the database push succeeds, deploy the exact verified
compatible application commit. Verify it in production before opening PR2.
Do not let an automatic application deployment overtake either database push.

PR1 remains compatible with the previous application during cutover. The old
feedback projection can still read its legacy columns, and authenticated
assignment reads retain their old grant until PR2. The new application uses the
safe RPCs and works in both the expanded and contracted states.

## PR2: contract identity access after production cutover

PR2 was created only after PR1 was verified in production. It added a new migration
with a timestamp later than every PR1 migration. That migration:

1. Aborts unless `get_founder_pitch_feedback`, `get_my_feedback_history`,
   `can_rate_feedback`, `get_review_queue_snapshot`,
   `get_review_assignment_detail`, and `get_event_review_assignments` exist.
2. Revokes direct anon/authenticated feedback identity access.
3. Revokes direct anon/authenticated `review_assignments` access.
4. Preserves service-role audit and operational access.

PR2 was applied to staging with the identity-role pgTAP suite before production
promotion. Founder, author, organizer, administrator, dual-role, and
unrelated-user disclosure behavior was verified before the release completed.

## Compatibility matrix

| Application | Database state | Supported |
|---|---|---|
| Previous application | PR1 expanded schema | Yes |
| Compatible application | PR1 expanded schema | Yes |
| Compatible application | PR2 contracted identity grants | Yes |
| Previous application | PR2 contracted identity grants | No, by design |

The unsupported combination fails closed instead of exposing feedback or
assignment identity.

## Rollback

Before PR2, either the previous or compatible application can run against PR1.
After PR2, application rollback must target a compatible build that uses the
safe RPCs. Do not roll back to a build that directly selects identity columns.

If a contract defect requires emergency recovery, deploy a forward-fix
migration and a compatible application build. Do not restore broad browser
table grants or run a destructive schema down migration. Service-role jobs
remain supported throughout the rollout.

A database migration cannot prove which application deployment is live.
Therefore, the PR1 production smoke result and exact application commit remain
mandatory preconditions in the PR2 release manifest.
