-- Run the provider-independent nudge endpoint hourly so each founder's local
-- delivery preference can be honored. The job safely no-ops until both Vault
-- secrets documented in docs/agent/NUDGE_SCHEDULER.md are configured.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS app_private;

CREATE OR REPLACE FUNCTION app_private.invoke_hourly_nudge_sweep()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  endpoint TEXT;
  cron_secret TEXT;
BEGIN
  SELECT decrypted_secret
  INTO endpoint
  FROM vault.decrypted_secrets
  WHERE name = 'pip_nudge_endpoint'
  LIMIT 1;

  SELECT decrypted_secret
  INTO cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'pip_cron_secret'
  LIMIT 1;

  IF endpoint IS NULL OR cron_secret IS NULL THEN
    RAISE LOG 'PiP nudge sweep skipped: Vault scheduler secrets are not configured.';
    RETURN NULL;
  END IF;

  RETURN net.http_get(
    url := rtrim(endpoint, '/') || '/api/cron/send-nudges',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || cron_secret,
      'User-Agent', 'PitchInPublic-Supabase-Cron/1.0'
    ),
    timeout_milliseconds := 10000
  );
END;
$$;

REVOKE ALL ON FUNCTION app_private.invoke_hourly_nudge_sweep() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.invoke_hourly_nudge_sweep() FROM anon;
REVOKE ALL ON FUNCTION app_private.invoke_hourly_nudge_sweep() FROM authenticated;

DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'pip-hourly-nudge-sweep'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'pip-hourly-nudge-sweep',
    '5 * * * *',
    'SELECT app_private.invoke_hourly_nudge_sweep();'
  );
END;
$$;

COMMENT ON FUNCTION app_private.invoke_hourly_nudge_sweep() IS
  'Calls the authenticated PiP nudge API from Supabase Cron using Vault secrets.';
