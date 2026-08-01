# Organizer Outcome Report Runbook

Last updated: 2026-08-01

## Purpose

Use the private event outcome report to reconcile founder participation, practice
progress, feedback responsiveness, and final submissions after or during a pilot.
The report is an operational outcome summary. Historical pitches do not have a
direct event foreign key, so take metrics are conservative event-window proxies,
not causal proof of program impact.

## Access

Report page:

```text
/events/[slug]/report
```

JSON and CSV API:

```text
/api/events/[slug]/outcomes
/api/events/[slug]/outcomes?format=csv
```

Allowed:

- Event owner.
- Active event participant with `organizer` or `admin` role.

Denied:

- Signed-out users.
- Founders, coaches, mentors, and judges.
- Removed/inactive organizers and admins.
- Authenticated users attached only to another event.

The API authenticates and authorizes through the request-scoped Supabase client
before constructing the service-role client. Responses use `private, no-store`.

## Source Rules

- **Invited:** unique, non-revoked founder invitation emails.
- **Joined:** active founder event memberships.
- **Eligible activity:** a published, non-deleted pitch created from the founder's
  join timestamp through the earlier of report generation and the event cutoff.
- **Event cutoff:** the later of the submission deadline or end of pitch day.
- **Submitted pitch:** always included for its founder even when it falls outside
  the normal eligible-activity window.
- **First Take:** joined founder has at least one eligible take.
- **Improved Take:** joined founder has at least two eligible takes.
- **Feedback coverage:** First-Take founders with feedback on an eligible take,
  divided by all First-Take founders. Feedback after the event cutoff is excluded.
- **Time to first feedback:** elapsed time from the first eligible take to the first
  valid feedback timestamp on that take. Average and median exclude missing or
  negative timings and show their sample size.
- **Best Take:** an eligible or submitted pitch has `is_best_take = true`.
- **Final submission:** event submission status is `submitted` or `locked`, with a
  valid submission timestamp no later than the event cutoff.
- **Pitch-ready:** the submitted take, or latest eligible take when none is
  submitted, has at least one structured readiness value of `4`.
- **Improvement signals:** normalized structured signal labels from Roast feedback.

## Privacy Contract

The page, JSON response, and CSV must not contain:

- Event, founder, participant, invitation, pitch, submission, or feedback UUIDs.
- Invite or access codes.
- Raw feedback `content`.
- Public or private feedback notes.

The report-specific parser accepts only feedback type, readiness values from 1-4,
signal labels up to 80 characters, and timestamps. Malformed content is treated as
an unstructured private note and discarded. CSV cells are quoted and formula-like
values are prefixed before spreadsheet parsing.

## Pilot Reconciliation

1. Open the event dashboard as the event owner.
2. Open **Outcome report** and confirm the event name and reporting window.
3. Compare unique non-revoked founder invitation emails with **Invited**.
4. Compare active founder memberships with **Joined**.
5. Spot-check one founder with zero takes, one with one take, and one with two or
   more takes against First Take and Improved Take.
6. Confirm the submitted and Best Take states for at least two founders.
7. Confirm feedback coverage and first-feedback timing against the first eligible
   take for a sampled founder.
8. Download CSV and verify the row count and stable column order.
9. Search the CSV for a known UUID, invite code, and private-note phrase. None may
   appear.
10. Open print preview on desktop. Confirm the event identity, report period,
    metric sections, roster headings, and definitions remain visible.
11. Check the page at 375px width. Actions stack, metrics remain two columns, roster
    entries become labeled rows, and no horizontal scrolling is required.

## Cross-Event Security Check

Use two events with different organizer teams and founder data:

1. As an organizer for event A, request event B's report page and CSV endpoint.
2. Confirm the response is `403` or `404` and contains no event B metadata.
3. Remove an organizer/admin membership from event A and repeat the event A request.
4. Confirm no service-backed data is returned.

## Troubleshooting

- `401`: sign in with the organizer account.
- `403`: confirm the account is the event owner or an active organizer/admin.
- `404`: verify the slug and confirm the event is visible to the signed-in account.
- `503`: confirm Supabase URL, anon key, and service-role key are configured.
- `500`: retry once, then inspect server logs for the failed source category. The
  endpoint intentionally returns no partial report or CSV when a required read fails.

## Verification Commands

```bash
npm run test:event-outcomes
npm run lint
npm run build
```
