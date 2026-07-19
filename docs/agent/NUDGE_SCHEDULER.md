# Nudge Scheduler

## Decision

Pitch in Public sends founder nudges according to each founder's selected local
time and time zone. The sweep runs hourly at five minutes past the hour. A
two-hour delivery window tolerates a delayed invocation without sending stale
messages later in the day.

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
founder is currently inside their local delivery window. Confirm actual sends
and dedupe outcomes in `nudge_events`.

## Operational Behavior

- The app decides eligibility using the founder's time zone, local time, and
  enabled preference.
- Daily dedupe keys are based on the founder's local calendar date.
- Event deadline reminders have independent event/user dedupe keys.
- Daily prompts and event deadline reminders both respect the founder's selected
  local delivery time.
- Provider failures are marked `failed` and may be reserved once more by the
  next hourly sweep; sent or currently queued rows remain deduplicated.
- Invalid stored time zones or times fall back to 9:00 AM America/New_York so a
  malformed legacy preference cannot crash the entire sweep.
- Keep the hourly job idempotent. Do not remove the unique dedupe index.
