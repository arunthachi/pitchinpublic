alter table public.organizer_invitations
  add column if not exists email_status text not null default 'unknown',
  add column if not exists email_error text,
  add column if not exists email_sent_at timestamptz;

comment on column public.organizer_invitations.email_status is
  'Delivery state for the invite email: unknown, skipped, sent, failed, or not_configured.';

comment on column public.organizer_invitations.email_error is
  'Last email provider error for debugging organizer invite delivery.';

comment on column public.organizer_invitations.email_sent_at is
  'Timestamp when the invite email provider accepted the message.';
