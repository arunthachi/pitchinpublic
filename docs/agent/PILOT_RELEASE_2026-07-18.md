# Pilot Release Verification - 2026-07-18

## Release Scope

This release integrates the founder practice loop, organizer event workflow, invite-only access, review marketplace, email operations, mobile/PWA polish, and launch security hardening.

## Founder Flow Verified

- Invite-only Google/email authentication and access checks.
- Mobile-first feed and responsive 9:16 video presentation.
- Quick Toast/Roast reactions with one click.
- Scrollable structured feedback with multiple signals, readiness, and an optional note.
- Assigned review queue, review credits, and usefulness ratings.
- Assigned reviews now open inside the Stage/video experience instead of navigating to the legacy full-page pitch detail screen.
- Review URLs and client payloads expose only the pitch public ID; assignment identifiers are resolved and completed on the server.
- Review submission is atomic and idempotent, so retries cannot create duplicate feedback or credit.
- Startup profile reuse across pitch takes.
- 31-second portrait upload, Cloudflare processing, and transition to publish metadata.
- Best-take, practice momentum, goal, notification preference, and profile routes.

## Organizer Flow Verified

- Invite-only organizer onboarding.
- Event dashboard authorization and role-aware management.
- Founder and team invitations, including verified Resend delivery.
- Event roster, submissions, assignments, announcements, and feedback coverage.
- Announcement delivery to a controlled Resend recipient.
- Configurable pitch length, focus areas, access codes, and event visibility.

## Security Verification

- Private and unlisted event membership fails closed without a valid invite or access code.
- Event invitation use is validated, consumed, and rolled back if membership creation fails.
- Direct client inserts into event membership are denied by RLS.
- Anonymous and unrelated authenticated users cannot read private invitations, participants, review assignments, credit ledgers, or quality votes.
- Service-role event setup is limited to authenticated organizer API paths.
- Tracked-source secret scan found no committed service keys or provider tokens.
- Supabase schema lint reports no errors for staging or production.

## Engineering Gates

- `npx tsc --noEmit`: passed.
- `npm run build`: passed on Next.js 16.2.10.
- `npm run lint`: passed with warnings only.
- `git diff --check`: passed.
- `npm audit --omit=dev --audit-level=high`: no high or critical findings.
- Staging landing response: HTTP 200, approximately 0.16 seconds in release check.
- Staging health response: HTTP 200, approximately 0.82 seconds in release check.

## Assigned Review Interaction Contract

- Phone layouts use a lower feedback sheet capped near 70% of the viewport so the pitch remains visible.
- Desktop layouts use a bounded sidecar or dialog instead of replacing the Stage.
- The form owns its internal scroll area, keeps the submit action reachable above safe areas and the software keyboard, traps focus while open, and returns focus when closed.
- Toast/Roast, up to three signal chips, readiness, and an optional note remain the complete fast-review path.
- Assignment UUIDs are never placed in routes, query strings, or browser-facing queue responses.

## Residual Pilot Checks

- Validate camera capture on at least one physical iPhone Safari and one Android Chrome device. Browser emulation validates layout and file upload but cannot prove every device camera implementation.
- Monitor the inherited moderate PostCSS advisory in the latest stable Next.js release; upstream currently offers no non-breaking fixed Next.js version.
- Treat pilot engagement as behavior validation, not product-market fit. Track useful-review density and second-take completion before opening access broadly.
