alter table public.notification_preferences
  add column if not exists founder_nudges_enabled boolean not null default true,
  add column if not exists reviewer_digest_enabled boolean not null default true,
  add column if not exists organizer_digest_enabled boolean not null default true;

comment on column public.notification_preferences.founder_nudges_enabled is
  'Controls founder practice prompts and founder event deadline reminders.';

comment on column public.notification_preferences.reviewer_digest_enabled is
  'Controls review assignment reminders and reviewer queue digests.';

comment on column public.notification_preferences.organizer_digest_enabled is
  'Controls organizer readiness digests and deadline exception alerts.';
