# Role-Aware Notification Coordinator

## Decision

Pitch in Public runs one role-aware email coordinator. It sends the most
important eligible message for each user according to that user's selected
local time and time zone. The sweep runs hourly at five minutes past the hour.
A two-hour delivery window tolerates a delayed invocation without sending stale
messages later in the day.

The coordinator enforces a 20-hour cooldown across all automated,
nontransactional email. If a user has multiple roles, deadline exceptions beat
weekly summaries, and weekly summaries beat routine founder practice prompts.
Transactional invitations and organizer announcements are separate from this
coordinator.

Supabase Cron owns hourly scheduling. Vercel Cron remains a once-daily fallback
because the current Vercel Hobby plan does not permit hourly cron jobs. The
`nudge_events.dedupe_key` unique index makes overlapping or retried invocations
safe.

## One-Time Setup Per Environment

Apply all database migrations, then add these secrets in Supabase Vault. Use the
environment's app URL and the exact same `CRON_SECRET` configured in Vercel.

```sql
select vault.create_secret(
  'https://staging-pip.pitchinpublic.io',
  'pip_nudge_endpoint',
  'PiP nudge endpoint for this environment'
);

select vault.create_secret(
  '<same value as Vercel CRON_SECRET>',
  'pip_cron_secret',
  'Bearer token for the PiP nudge endpoint'
);
```

For production, use `https://app.pitchinpublic.io` as `pip_nudge_endpoint`.
Never commit the bearer token to Git or place it in a public environment
variable.

If a named secret already exists, update it instead of creating a duplicate:

```sql
select vault.update_secret(
  (select id from vault.decrypted_secrets where name = 'pip_nudge_endpoint'),
  'https://app.pitchinpublic.io'
);
```

Repeat for `pip_cron_secret` when rotating `CRON_SECRET`.

## Verification

Confirm the job exists:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'pip-hourly-nudge-sweep';
```

Run one request immediately and inspect its asynchronous response:

```sql
select app_private.invoke_hourly_nudge_sweep() as request_id;

select id, status_code, content, error_msg, created
from net._http_response
order by created desc
limit 5;
```

The endpoint should return HTTP 200. A valid run may send zero emails when no
recipient is currently inside their local delivery window. Confirm actual sends
and dedupe outcomes in `nudge_events`.

## Operational Behavior

- Founder messages:
  - Daily practice prompt when an active practice goal exists.
  - Event deadline reminders at 7 days, 72 hours, and 24 hours.
  - Event reminders stop once a founder has a submitted or locked take.
- Reviewer messages:
  - Due-soon alert when an assigned review is due within 24 hours.
  - Tuesday digest when outstanding assigned reviews remain.
- Organizer/admin messages:
  - Monday event-readiness digest.
  - 72-hour and 24-hour exception alerts only when founder submissions are
    missing.
- Every role can independently pause its automated messages. A master email
  switch pauses all automated messages.
- All automated messages respect the recipient's selected local delivery time.
- Daily and weekly dedupe keys use the recipient's local calendar.
- Event reminders use milestone-specific event/user dedupe keys.
- Email links use public event slugs. Database UUIDs are never placed in
  recipient-facing URLs.
- Provider failures are marked `failed` and may be reserved once more by the
  next hourly sweep; sent or currently queued rows remain deduplicated.
- Invalid stored time zones or times fall back to 9:00 AM America/New_York so a
  malformed legacy preference cannot crash the entire sweep.
- Keep the hourly job idempotent. Do not remove the unique dedupe index.
