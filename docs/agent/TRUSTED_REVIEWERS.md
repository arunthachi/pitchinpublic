# Trusted Reviewers

## Purpose

Trusted reviewers are experienced people who improve feedback quality without
needing to publish a pitch. Examples include investors, product leaders, past
judges, mentors, and experienced operators.

## Access model

- Access is invitation-only and granted by a platform super admin.
- Invitations are bound to one normalized email address, expire, and store only
  a SHA-256 hash of the bearer token.
- Accepting an invitation creates or reactivates one durable reviewer
  membership. Revoking the membership removes reviewer access immediately.
- A user may hold reviewer access alongside other application roles. Dual-role
  accounts default to founder mode and can switch modes from desktop or mobile.
- Reviewer titles, organization, roles, and expertise are credentials, not
  authorization inputs.

## Pitch visibility

Trusted reviewers may see:

1. Active, published pitches whose visibility is `public`.
2. Active, published pitches submitted or locked to a private event only when
   the reviewer has an explicit active grant for that event.

Trusted reviewers may never gain reviewer access to drafts, deleted pitches,
unpublished takes, unrelated private events, or their own pitches. Database RLS
is authoritative; UI filtering is only presentation.

## Reviewer workflow

1. A super admin creates an email-bound invitation and selects one or more
   reviewer roles.
2. The reviewer authenticates using the invited email and accepts the invite.
3. Reviewer-only accounts open in Review mode with a compact review queue and
   no founder recording, pitch-goal, Best Take, or review-credit controls.
4. The reviewer submits one Toast or Roast response per pitch using up to three
   signals, readiness, and an optional note.
5. The pitch owner can rate the response as useful, generic, or not helpful.

Feedback remains accountable internally. Public feedback shows the reviewer's
professional title and organization plus a concise expertise summary without
exposing email addresses or database identifiers.

## Super-admin operations

The Trusted reviewers tab supports invite, resend, revoke invitation, revoke
active access, multiple roles,
professional credentials, expertise, and independently revocable private-event
grants by event slug. Database UUIDs are resolved server-side and are not used
in browser URLs or public control payloads.

## Security invariants

- Every super-admin endpoint calls the platform-admin authorization guard.
- Invite and acceptance endpoints are rate limited.
- Reviewer acceptance verifies both the token and authenticated email.
- RLS controls pitch visibility; a copied pitch URL cannot expand access.
- Self-feedback is rejected by both the API and database.
- A database trigger permits one feedback response per reviewer and pitch;
  idempotent retries are resolved by the submission RPC before insertion.
- Event grants are explicit and do not imply access to other organizer events.

## Pilot verification

1. Apply `20260722223000_add_trusted_reviewers.sql` to staging.
2. Invite a reviewer whose account has no founder pitches.
3. Confirm public published pitches are visible and drafts are not.
4. Grant one private event and confirm only that event's published,
   submitted/locked pitches become visible.
5. Confirm self-review and a second review on the same pitch are rejected.
6. Confirm revoking membership removes reviewer feed access.
7. Verify invite, queue, feedback, and admin controls at 390x844 and desktop.
