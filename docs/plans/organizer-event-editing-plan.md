# Organizer Event Editing and Guided Setup Plan

Issue: GitHub #4
Branch: `codex/organizer-event-editing`
Base: `main`

## Outcome

Authorized event organizers and active event admins can edit event-owned settings from the existing dashboard. The same saved data is returned by the slug API, so organizer and founder views reflect updates on their next load. The dashboard also presents a derived setup checklist that directs organizers into existing invite, preview, and announcement workflows.

## Premises

1. Event ownership and active organizer/admin participation are the only management grants. Coach, mentor, and judge participation remains read-only.
2. The public slug is the route identifier; event UUIDs stay internal to server-side queries and are never included in route parameters or error messages.
3. The existing `focus` text column remains the persistence format for this issue. Multiple selections are serialized with the established delimiter and parsed by existing founder/dashboard views, avoiding a schema migration.
4. Setup checklist completion is derived from existing event, invitation/participant, and announcement data. The issue does not require durable manual checklist state.
5. Event visibility retains the existing database values (`private`, `unlisted`, `public`) while the UI explains access consequences in plain language.

## What Already Exists

- `src/app/api/events/route.ts` validates event creation, already accepts multiple focuses and 30-360 second pitch lengths, and writes pitch-hour fields.
- `src/app/api/events/[slug]/route.ts` loads event/team data and already computes `canManageEvent` for owner or active organizer/admin participants.
- `src/app/events/new/page.tsx` contains the focus choices, visibility copy, duration choices, and pitch-hour controls needed for editing.
- `src/app/events/[slug]/dashboard/page.tsx` contains the organizer workspace, founder/team invite workflows, founder preview link, announcements, and explicit management gating.
- RLS permits the owner to update events. Team-admin updates need a server-side service client after an explicit authorization check because the current RLS policy only grants direct owner updates.
- `supabase/migrations/016_extend_event_pitch_length.sql` already permits pitch durations through 360 seconds.

## Scope

### API

1. Extract a focused event update schema/helper near the slug route so validation is unit-testable without mocking Next/Supabase internals.
2. Add `PATCH /api/events/[slug]` with:
   - Authentication required.
   - Event lookup by slug with no UUID in client-facing errors.
   - Authorization for owner or active `organizer`/`admin` participant only.
   - Strict allowlist: name, description, event date, submission deadline, pitch duration, focuses, visibility, access code, review target, pitch-hour start/end.
   - Date validation that rejects a submission deadline after pitch day.
   - Paired pitch-hour validation and end-after-start enforcement.
   - Focus normalization/deduplication and 1+ focus requirement.
   - Atomic event update and `updated_at` refresh.
   - Stable generic 401/403/404/400/500 messages without database identifiers or details.
   - Explicit access-code intent (`keep`, `replace`, or `remove`) so an omitted/blank value cannot erase a secret the client was never allowed to read.
3. Keep RLS intact. Use the authenticated client for owner updates; for authorized team admins, use the service client only after the explicit membership check, scoped by the resolved event UUID and slug.

### UI

1. Reuse the creation form semantics in a dedicated event edit component opened from the dashboard for users with `canManageEvent`.
2. Seed all editable values from the loaded event, including parsing multiple focuses and converting pitch-hour timestamps to/from `datetime-local` safely.
3. Keep duration choices through 6 minutes, multiple focus selection, clear access labels/helpers, and pitch-hour controls. Visibility copy must match current join enforcement: private is hidden and invitation-required, unlisted has a shareable page but remains invitation-required, and public allows any signed-in founder to join.
4. Validate deadline/pitch-day combinations client-side for immediate feedback while treating server validation as authoritative.
5. Submit pessimistically with disabled controls, preserve the current form until success, show an `aria-live` success/error message, and replace dashboard event state from the PATCH response so organizer data updates immediately.
6. Add a guided setup checklist to the overview with five actions:
   - Create room: complete once the event exists.
   - Invite founders: complete when a founder invite or founder participant exists; action opens Team/founder invite area.
   - Invite judges/coaches: complete when a pending/accepted team invite or active coach/mentor/judge participant exists; action opens Team.
   - Preview founder experience: actionable link to the existing founder view; presented as an action rather than falsely persisted completion.
   - Send welcome announcement: complete when at least one announcement exists; action opens Announcements.
7. Keep edit and checklist controls available only to managers. Team members retain the current dashboard without edit controls.
8. Ensure 44px minimum targets, visible focus states, semantic labels/fieldsets, keyboard operability, no horizontal form overflow, and compact single-column mobile layout before desktop enhancement.

### Tests and Verification

1. Add focused Node tests for update parsing/normalization and authorization decisions, following the repository's `tsx --test` pattern.
2. Cover owner, active organizer/admin, inactive manager, and coach/mentor/judge authorization outcomes.
3. Cover valid update output, multiple focus serialization/deduplication, 360-second duration, access-code keep/replace/remove semantics, invalid date ordering, incomplete/invalid pitch-hour windows, and unknown fields being rejected by the strict schema.
4. Add route-level tests with injected/mock dependencies where the repository pattern permits, asserting 401/403/404/400/success behavior in addition to pure helper coverage.
5. Add a package script for the focused event tests.
6. Run focused tests, all existing test scripts, ESLint, and production build.
7. Run browser QA at 375x667, 390x844, 430x932, 1280x720, and 1440x900 against the local app where environment data permits. Verify edit open/close, keyboard focus, validation, save states, checklist navigation, and no overlap/overflow.

## Architecture

```text
Dashboard page
  | GET /api/events/[slug]
  |       -> authenticated Supabase client -> event + membership + related setup data
  |
  +-> EventEditForm
  |       -> PATCH /api/events/[slug]
  |              -> schema normalization
  |              -> authenticated event lookup
  |              -> owner/active manager authorization
  |              -> authenticated owner update OR scoped service update for team admin
  |              -> sanitized updated event response
  |
  +-> SetupChecklist
          -> derives status from event/invitations/participants/announcements
          -> navigates existing dashboard tabs / founder preview
```

## Failure Modes and Rescues

| Failure | Prevention | User-visible rescue |
|---|---|---|
| Unauthenticated PATCH | Server auth check | 401: sign-in required |
| Coach/judge attempts edit | Explicit role/status check | 403: organizer/admin access required |
| Event slug missing | Slug lookup | Generic 404 without internal ID |
| Deadline after pitch day | Shared schema refinement | Field-specific validation message |
| Only one pitch-hour endpoint | Shared schema refinement | Require both start and end |
| Concurrent/stale dashboard save | Disable duplicate submit; apply returned event only after success | Preserve edits and display retryable error |
| Service-role overreach | Service update only after auth, scoped to event ID + slug | Generic failure; audit server log only |
| Focus parsing drift | Shared normalization/delimiter helpers | Existing views continue parsing `·` and comma |
| Checklist overstates completion | Derive only from existing observable data | Preview remains an action, not fake persisted state |
| Blank access-code field erases an unknown secret | Require explicit keep/replace/remove intent | Default to keeping the existing code |
| Visibility copy promises access the join API denies | Derive labels from current join semantics | Explain page visibility separately from join permission |

## Not In Scope

- Payments, ticketing, discovery, or calendar integrations.
- Event slug changes, deletion, archival, or status management.
- New checklist database columns or manual completion toggles.
- Access-code rotation UX beyond editing the existing field.
- Refactoring the full dashboard or creation flow beyond small shared constants/helpers needed to prevent drift.

## Review Report

### CEO Review

- The issue directly removes a high-friction organizer workaround and builds on existing event infrastructure.
- The narrowest complete implementation keeps persistence compatible and derives checklist progress from current records.
- Six-month regret risk: duplicating creation/edit validation would cause drift. Shared server normalization and shared form option constants should be introduced only where they reduce that concrete drift.
- Alternative considered: separate `/events/[slug]/edit` page. Rejected because dashboard context is required for checklist actions and the issue explicitly asks for editing from the dashboard.
- Alternative considered: new normalized focus table and checklist-state table. Deferred because neither is required for current behavior and both expand migration/RLS scope.

CEO score: 9/10. Scope is complete for the stated outcome with explicit exclusions.

### Design Review

| Dimension | Score | Decision |
|---|---:|---|
| User flow | 9/10 | Dashboard edit trigger and in-context checklist minimize navigation. |
| Information hierarchy | 8/10 | Checklist belongs near overview; edit form uses grouped event/access/schedule sections. |
| Mobile responsiveness | 9/10 | Single-column first, constrained controls, tested at all requested sizes. |
| Accessibility | 9/10 | Semantic form groups, keyboard-safe controls, focus restoration, live status. |
| States and feedback | 9/10 | Explicit loading, validation, success, and failure states. |
| Design-system fit | 8/10 | Reuses existing dark inputs, buttons, panels, and Lucide icons. |
| Copy clarity | 9/10 | Access values are translated into consequences founders understand. |

Design risk: a large modal can be awkward at 375x667. Use a full-height mobile dialog/sheet behavior with an internal scroll region and sticky action area, while desktop may use a bounded dialog.

### Engineering Review

- Authorization must be independently testable and fail closed for inactive or non-manager roles.
- The Supabase service client is acceptable only for active team-admin updates after explicit checks; owner writes should continue through RLS.
- Strict schema parsing must prevent organizer ID, slug, status, or other ownership fields from entering the update payload.
- Date-only values should be compared as calendar strings/dates consistently to avoid timezone shifts.
- The PATCH response should expose the same sanitized event shape as GET and never the access code unless the manager edit UI explicitly needs it. Since current GET strips access code, the edit form should treat it as replacement-only/blank rather than leaking the stored code.
- Access-code updates need explicit keep/replace/remove intent; an empty replacement field defaults to keeping the existing value.
- Visibility helpers must follow `join/route.ts`: private and unlisted both require an invitation/access code for new members, while public permits open signed-in joining.
- Testability improves by extracting pure schema/authorization/update-payload functions into `_server.ts`, matching existing repository test patterns.

Engineering score: 9/10. Primary residual risk is exercising authenticated Supabase behavior without an integration-test harness; pure tests plus lint/build and browser QA cover the repository-supported surface.

### Test Diagram

```text
PATCH input
  +-> valid fields -> normalized DB patch -> unit test
  +-> invalid dates -> 400 issues -> unit test
  +-> invalid duration/window/focus -> 400 issues -> unit test
  +-> forbidden extra fields -> strict rejection -> unit test

Authenticated actor
  +-> owner -> allowed -> auth unit test
  +-> active organizer/admin -> allowed -> auth unit test
  +-> inactive organizer/admin -> denied -> auth unit test
  +-> coach/mentor/judge/founder -> denied -> auth unit test

Dashboard
  +-> manager opens, edits, saves -> browser QA
  +-> non-manager sees no edit controls -> browser QA/API auth test
  +-> checklist derives statuses/actions -> focused pure test where extracted + browser QA
  +-> mobile/desktop layout and keyboard flow -> viewport QA
```

### Cross-Phase Themes

1. Authorization is the highest-confidence risk: every phase supports explicit owner/active-manager checks and fail-closed behavior.
2. Reuse is important only at validation/options boundaries; avoid broad dashboard refactoring.
3. Mobile dialog behavior and honest checklist completion semantics are required for a trustworthy organizer experience.

## Implementation Tasks

1. Add shared event update validation/authorization helpers and focused tests.
2. Implement sanitized, authorized `PATCH /api/events/[slug]` behavior.
3. Add reusable event form constants/component behavior for edit mode without changing unrelated creation behavior.
4. Add manager-only dashboard editing with immediate local refresh and accessible status handling.
5. Add the derived guided setup checklist wired to current tabs and founder preview.
6. Run focused/all tests, lint, build, and requested viewport QA; fix regressions.
7. Review diff/security boundary, commit, and push `codex/organizer-event-editing`.

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 1 | CEO | Keep focus persistence in the existing text column | Mechanical | DRY/pragmatic | Existing create and read paths already serialize and parse multiple focuses | New focus table |
| 2 | CEO | Derive checklist state from existing data | Mechanical | Explicit/pragmatic | Issue asks for guidance, not durable arbitrary checkbox state | Checklist migration |
| 3 | Design | Use an in-dashboard responsive dialog/sheet | Taste | Completeness | Preserves dashboard context and supports mobile ergonomics | Separate edit page |
| 4 | Design | Treat founder preview as an action, not persisted completion | Mechanical | Explicit | There is no reliable existing signal that a preview occurred | Fake completion state |
| 5 | Eng | Extract pure update helpers for tests | Mechanical | Explicit/DRY | Route authorization and payload behavior become testable in the current harness | Route-only untested logic |
| 6 | Eng | Keep stored access code write-only in edit UI | Mechanical | Security | Current GET intentionally strips it; exposing it would weaken the existing boundary | Return stored access code |
| 7 | Eng | Use service role only for explicitly authorized active team admins | Mechanical | Completeness/security | Existing RLS only permits owner writes while acceptance requires admin editing | Broaden RLS in this issue |
| 8 | Eng | Model access-code edits as keep/replace/remove | Mechanical | Security/explicit | The existing secret is intentionally absent from GET, so blank input is ambiguous | Implicit blank-to-clear behavior |
| 9 | Design | Make visibility copy match join enforcement | Mechanical | Explicit | Unlisted is shareable but still invite-only in the current API | Existing inaccurate helper copy |

## GSTACK REVIEW REPORT

Reviewed sequentially for product scope, mobile/accessibility design, authorization architecture, test coverage, failure modes, and developer maintainability. No user-direction challenge was identified. One taste choice remains: in-dashboard responsive dialog/sheet versus a separate edit route; the reviewed recommendation is the in-dashboard surface because it best supports checklist-driven setup.
