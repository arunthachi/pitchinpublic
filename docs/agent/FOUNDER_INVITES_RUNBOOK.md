# Independent Founder Invitations

Independent founder invitations let a platform super admin admit founders who
are not joining through an organizer event. They are the default access path for
the invite-only founding cohort.

## Access Model

- Marketing pages remain public.
- The founder app remains invite-only.
- Event invitations continue to grant access through their event flow.
- Independent invitations grant durable access by creating a `pilot_members`
  record with source `founder_invite` after acceptance.
- A pending invitation can start authentication, but it does not grant access
  to app data by itself.
- Existing pilot members are never locked out when an invitation expires or is
  revoked.

## Admin Flow

1. Sign in as the platform super admin.
2. Open `/pip-super-admin` and select `Founder invites`.
3. Enter the founder email, an optional cohort label, and expiry.
4. Create the invitation. The app emails the founder and shows the acceptance
   URL once for operational recovery.
5. Use `Resend` to rotate the secret and invalidate the previous URL.
6. Use `Revoke` to stop an unaccepted invitation.

Invitation history must never display raw tokens. It may show email, cohort,
status, expiry, delivery status, and timestamps.

## Founder Flow

1. The founder opens `/founder/invite?token=...`.
2. The page validates the invitation and identifies the invited email.
3. The founder signs in with Google or email OTP using that email.
4. The server atomically accepts the invitation and creates durable pilot
   membership.
5. The founder lands in the practice feed.

If the authenticated email differs from the invited email, the invitation is
not accepted. The founder is prompted to use the invited account.

## Security Rules

- Store only a SHA-256 hash of the invitation token.
- Treat the raw token as a one-time secret and never log it.
- Use a transactional, row-locking database function for acceptance.
- Allow only one active independent invitation per normalized email.
- Enforce expiry and revocation server-side.
- Keep invitation tables denied by default under RLS.
- Rate-limit create, resend, resolve, and accept endpoints.
- Record administrative and delivery attempts without storing secrets.

## Environment

```text
FOUNDER_INVITES_ENABLED=true
RESEND_API_KEY=...
LEAD_EMAIL_FROM=Pitch in Public <hello@mail.pitchinpublic.io>
NEXT_PUBLIC_APP_URL=https://app.pitchinpublic.io
```

Set `FOUNDER_INVITES_ENABLED=false` to stop new create, resend, resolve, and
accept operations without removing existing pilot members.

## Verification

Before promotion, verify:

- Admin access is denied to non-platform-admin users.
- Create sends an email and returns a URL only in that response.
- The same email cannot receive two active invitations.
- Resend invalidates the old URL.
- Revoked and expired URLs cannot be accepted.
- A mismatched authenticated email cannot accept.
- Acceptance is idempotent and creates one `pilot_members` row.
- The accepted founder can sign in again without reusing the invite.
- No raw token appears in database rows, logs, admin history, analytics, or URL
  query strings after acceptance.

## Rollback

1. Set `FOUNDER_INVITES_ENABLED=false` in Vercel and redeploy.
2. Revoke pending invitations from the admin UI or database.
3. Do not delete accepted `pilot_members` records unless intentionally removing
   a founder from the pilot.

The feature flag stops invitation operations. It does not revoke durable access
already granted to accepted founders.
