# Pitch in Public Codex Agent Handbook

Status: Canonical engineering and agent operating manual
Audience: Codex agents, reviewers, maintainers, and release operators
Last reviewed: 2026-08-03
Repository: `arunthachi/pitchinpublic`

This handbook explains how agents must understand, change, test, and ship Pitch in Public. Its purpose is to preserve product intent, reduce hallucination, prevent environment mistakes, and make parallel delivery reliable.

## 1. Agent Mission

Agents exist to improve the product without weakening its core loop:

```text
Record -> Receive useful feedback -> Improve -> Repeat -> Select Best Take
```

Every implementation decision should answer four questions:

1. Does it make pitch practice easier or more valuable?
2. Does it increase the supply or quality of useful feedback?
3. Does it preserve founder trust and invite-only access?
4. Does it work cleanly on a mobile browser?

Do not optimize for feature count, visual novelty, or passive feed consumption at the expense of this loop.

## 2. Mandatory Reading Order

Before a non-trivial task:

1. Read root `AGENTS.md`.
2. Read `docs/product/PITCH_IN_PUBLIC_PRODUCT_HANDBOOK.md`.
3. Read this handbook.
4. Read the relevant source files and migrations.
5. Read applicable specialist runbooks in `docs/agent/`.
6. Inspect current branch, worktree, status, recent commits, and deployment target.

Do not begin with an old chat summary or issue description and assume it represents deployed behavior.

## 3. Source-of-Truth Precedence

When sources disagree, use this order:

1. Current deployed configuration and observed runtime behavior.
2. Current release-branch code and ordered database migrations.
3. Automated tests and reproducible API/browser evidence.
4. Canonical product and Codex handbooks.
5. Current runbooks and accepted architecture decisions.
6. Open issues, pull requests, task notes, and conversation history.
7. Assumptions and model memory.

Code is authoritative for what exists, but not automatically for what should exist. The product handbook is authoritative for intended direction. A discrepancy between them is a finding to document, not a reason to silently rewrite either.

## 4. Anti-Hallucination Protocol

### 4.1 Label product claims

Use one of these labels whenever status could be ambiguous:

- `Current`: confirmed in code and, when relevant, deployed behavior.
- `Verify`: implemented or configured, but still requiring environment evidence.
- `Planned`: approved direction not yet implemented.
- `Proposed`: recommendation awaiting approval.
- `Deferred`: explicitly outside the current release.
- `Removed`: intentionally no longer supported.

Never say a feature is complete because a component, migration, or route merely exists.

### 4.2 Separate fact, inference, and proposal

- Fact: cite a file, migration, test, API response, or observed browser state.
- Inference: state the evidence and identify it as an inference.
- Proposal: explain the tradeoff and wait for approval when the change is non-trivial.

### 4.3 Evidence required for completion

A completion claim must include:

- commit or diff scope;
- checks run and their results;
- environment actually tested;
- role/account path tested;
- database migrations applied, if any;
- known residual risks or untested device-specific behavior.

Do not use “production-ready,” “fully tested,” “fixed,” or “deployed” without that evidence.

### 4.4 Never invent operational state

Do not guess:

- whether a migration was applied;
- whether Vercel has deployed a commit;
- whether an email was delivered;
- whether Cloudflare finished processing a video;
- whether RLS protects a path;
- whether a user has a role or invitation;
- whether staging and production use the same environment values.

Query or test the relevant system. If access is unavailable, state exactly what remains unverified.

## 5. Context Restoration Checklist

At the beginning of a resumed or compacted task, run:

```bash
pwd
git status --short --branch
git worktree list
git log --oneline --decorate -8
git branch -vv
```

Then answer internally:

- Which worktree is active?
- Which branch is active?
- Is it ahead or behind `origin`?
- Are there user-owned changes?
- Which environment will this branch deploy to?
- Are migrations pending?
- What is the latest user request?

The normal release worktrees are:

```text
/Users/arunthachi/project/worktrees/pitchinpublic/test-env
/Users/arunthachi/project/worktrees/pitchinpublic/main
```

Always verify these paths; never assume the current Codex-generated worktree is the release worktree.

## 6. Branch, Worktree, and Environment Model

### Release branches

- `test-env`: staging integration branch.
- `main`: production branch.

### Feature branches

Use `codex/<short-scope>` unless the user specifies another branch. A feature worktree owns one coherent slice and should not modify files assigned to another parallel worker.

### Promotion sequence

```text
feature branch -> reviewed integration -> test-env -> staging verification
-> main -> production verification
```

Do not promote directly to `main` before staging verification unless the user explicitly accepts the risk for an emergency fix.

### Known Supabase references

- Staging has historically used `lzhgazflsidkzctjlawu`.
- Production has historically used `djzlqoqgvzxqcbualsbx`.

These are context hints, not authorization to operate. Verify the linked project before every migration or destructive database action.

## 7. Planning and Approval Gate

Non-trivial work requires an approved plan before editing. Non-trivial means any of:

- behavior spanning multiple files or surfaces;
- schema or RLS changes;
- authentication, invitations, roles, or permissions;
- recording, upload, processing, playback, or feedback changes;
- organizer or reviewer workflows;
- architecture or dependency changes;
- a user-facing redesign.

The plan must include:

1. Problem and user outcome.
2. Current behavior confirmed from code.
3. Proposed behavior and non-goals.
4. Data/API/UI changes.
5. Security and privacy impact.
6. Mobile behavior.
7. Test matrix.
8. Migration and rollback strategy.
9. Release and verification sequence.

Trivial edits such as copy corrections or isolated configuration changes may skip the full review, but still require diff review and a relevant check.

## 8. Parallel Agent Orchestration

Use a lead-worker model.

### Lead responsibilities

- define interfaces and acceptance criteria;
- split independent scopes;
- assign non-overlapping file ownership;
- track migration ordering;
- integrate branches;
- resolve conflicts based on product intent;
- run final end-to-end verification;
- own the final completion claim.

### Worker responsibilities

- work only in the assigned branch/worktree;
- inspect before editing;
- avoid unrelated refactors;
- add focused tests;
- commit a self-contained change;
- report files, behavior, checks, migration needs, and risks.

### Good parallel slices

- UI component and responsive tests.
- Server API and authorization tests.
- Database migration and RLS audit.
- Email template and delivery-path tests.
- Documentation and release notes.

### Bad parallel slices

- Two agents editing the same central component.
- Separate migrations that depend on unspecified ordering.
- UI and API work without an agreed payload contract.
- Multiple agents promoting branches independently.

### Worker task packet

Every worker should receive:

```text
Objective:
User outcome:
In scope:
Out of scope:
Owned files/directories:
Interfaces that must remain stable:
Required reading:
Acceptance criteria:
Commands/tests:
Security/mobile constraints:
Return format:
```

## 9. Engineering Rules

### General

- Follow existing patterns before introducing abstractions.
- Keep changes tightly scoped.
- Use typed interfaces and structured parsers.
- Do not suppress errors to make tests pass.
- Preserve unrelated user changes.
- Never commit credentials or environment values.
- Do not expose internal database UUIDs in user-facing URLs when a public identifier exists.

### Next.js and React

- Keep server-only secrets and service-role operations out of client bundles.
- Treat route handlers as authorization boundaries, not thin database proxies.
- Avoid unnecessary client components and broad re-renders.
- Provide explicit loading, empty, processing, retry, and error states.
- Ensure modal and drawer focus behavior is keyboard-safe.

### Supabase and PostgreSQL

- Every schema change requires an ordered migration.
- Use RLS as the data boundary; UI hiding is not access control.
- Avoid recursive policies. Prefer security-definer membership helpers where appropriate.
- Test allowed and denied actors.
- Add indexes for policy joins and common filters.
- Service-role access must remain server-side and narrowly scoped.
- Verify migrations independently in staging and production.

### Authentication and invitations

- Existing authorized users must continue to sign in.
- Invite acceptance must verify authenticated email ownership.
- Invite tokens must be opaque, expiring, revocable, and single-purpose.
- Event invitations must grant only event membership.
- Organizer and reviewer access must not silently replace founder access.
- Platform admin access must be role-checked server-side; hiding the route is not security.

### Video

- Cloudflare Stream is the implemented provider unless code proves otherwise.
- Respect upload size, duration, and aspect-ratio constraints with user-friendly messages.
- Treat upload success, processing readiness, and playable status as separate states.
- Test mobile recording, direct upload, processing polling, playback, seeking, mute, retry, and failure recovery.
- Do not delete provider assets until database references and retention requirements are confirmed.

### Feedback and review supply

- Prevent self-feedback unless an explicit product decision changes this.
- Keep feedback structured and fast: Toast/Roast, signals, readiness, optional note.
- Save atomically and show actionable failures.
- Preserve usefulness rating and assignment completion semantics.
- Do not let credits reward low-quality spam.

### Email and scheduled jobs

- Use verified sender domains.
- Include one clear CTA and a plain-text fallback URL.
- Validate recipient, role, environment URL, unsubscribe/preference rules, and idempotency.
- Cron endpoints require a secret and must tolerate retries.
- Scheduled sends should use user timezone windows, not assume one global send time.
- Log outcomes without leaking tokens or private data.

## 10. Mobile-First Contract

Mobile responsiveness is mandatory for every user-facing screen, not an optional acceptance criterion.

Test at minimum:

- 320 x 568
- 375 x 667
- 390 x 844
- 430 x 932
- 768 x 1024
- 1366 x 768
- 1440 x 900

Verify:

- no clipped primary action;
- no inaccessible content beneath fixed controls;
- drawers and modals scroll internally;
- body scroll locks are released on close;
- tap targets are at least 44 x 44 CSS pixels;
- text does not overflow;
- safe-area insets are respected;
- keyboard opening does not hide the active field or submit action;
- portrait video remains visible and correctly framed;
- navigation has a clear return path;
- PWA standalone mode remains usable.

Desktop is not a stretched mobile mockup. Use available width without reducing the video or feedback task to an awkward narrow column.

## 11. Security Review Matrix

For every protected feature, test at least:

1. Signed out.
2. Authorized owner/member.
3. Authenticated but unrelated user.
4. Wrong role.
5. Expired or revoked invite.
6. Tampered public identifier or token.
7. Direct API call bypassing the UI.

High-risk objects:

- profiles and startup data;
- pitch videos and metadata;
- feedback and usefulness ratings;
- event membership and submissions;
- organizer teams and announcements;
- reviewer assignments and credentials;
- platform invitations and admin operations;
- email preferences and scheduled notifications.

Never infer RLS safety from a successful UI test. Inspect policies and execute both allow and deny cases.

## 11a. Invariants Learned in Production

These were each discovered by shipping something that looked correct. Do not
re-derive them.

### Access and role state (`src/app/page.tsx`, `src/lib/access-gate.ts`)

1. `AuthContext` republishes a NEW `user` object on every auth event — hourly
   token refresh and every tab refocus. **Key auth-dependent effects on
   `user?.id`, never on the object.** Keying on the object once blanked the app
   mid-recording.
2. `history.replaceState` does NOT refresh `useSearchParams`. A query param
   stays set for the life of the page, so every query-param effect needs a
   one-shot ref (`handledRecordQueryRef`, `handledProfileEditQueryRef`) or it
   re-fires on every auth republish.
3. `accessCheckComplete` is already `true` while signed OUT. It is not a valid
   "this user is verified" signal on the render where sign-in lands.
4. **`/api/reviewer/access` answers 403 to any founder without reviewer
   membership — the majority case.** `isRoleResolved()` therefore means
   DEFINITIVE (200 or 403), not successful. Gating on `response.ok` would make
   the recorder unreachable for nearly every user.
5. A failed access check must still complete, or the access gate sticks. Role
   confidence is tracked separately (`roleResolved`), and entitlement comes from
   `canOpenRecorder()` using the reviewer/founder pair — never the display flag.

### Video privacy

- Signing is bound to VISIBILITY, not applied blanket. Public pitches keep a
  permanent canonical URL because founders share best takes on social media;
  signing them would hand out links that expire. Only `visibility = 'private'`
  is signed.
- A canonical Cloudflare URL is the delivery host plus the video id, and the
  host is visible in every public URL. **Never return `video_id` for a private
  pitch** — it lets a member rebuild a permanent unsigned URL.
- Tokens are minted AFTER RLS has selected rows, so they inherit the row's
  visibility. There is deliberately no second copy of the authorization rules.
- Minting is bounded: a shared Postgres cache (`video_playback_tokens`), an
  in-flight de-dupe, a per-response ceiling, and a timeout. The Cloudflare API
  quota is shared with uploads, so unbounded minting can lock founders out of
  recording.
- Attaching a video to a pitch requires having uploaded it (`video_uploads`).
  Both upload issuers record ownership; there are TWO.

### Feedback authorization

- Membership authorises feedback on a cohort take. Feedback already creates its
  own review assignment at submit time and a trigger marks it submitted, so
  nothing lands in `/api/reviews/queue` as pending work. Do NOT add a claim step.
- `feedback` has no `event_id`. The review assignment IS the event binding.
- Peer reviews are tagged `cohort_peer_feedback` AND excluded from organizer
  coverage. Tagging without excluding is useless: cohort activity would satisfy
  a "3 reviews per pitch" target and stop an organizer chasing their judges.

### Things that are bypassable

- The RLS policy `Users can update their own pitches` is
  `qual: (user_id = auth.uid())` with **`with_check: NULL`**. An owner can
  change any column, including `visibility`, straight through PostgREST.
  **Never bind a required side effect to an API endpoint that writes a
  client-writable column** — use a database trigger.

### Failure modes to check before claiming a change works

- A Tailwind class built by string interpolation is never generated: Tailwind
  scans source for complete class names, so the rule ships for the raw
  placeholder and the element silently loses the property.
- A plain `useRef` does not re-run an effect when its node mounts. Use a
  callback ref when the node appears asynchronously.
- An `aria-label` REPLACES descendant text. An `sr-only` span inside a labelled
  control is never announced; fold state into the label.
- A `SELECT` that omits a field makes every downstream decision on that field a
  silent no-op. This has shipped three times: `video_id`, `visibility`, and the
  fallback select.

## 12. Test Strategy

### Mutation-verify anything security- or accessibility-critical

A test that cannot fail is worse than no test: it reports safety that does not
exist. Before trusting one, reintroduce the defect, confirm the specific test
fails, then restore. Every claim of "verified" in this repo's PR history that
survived review was mutation-verified.

Four changes shipped or nearly shipped as DEAD CODE with passing tests, all the
same shape — the test asserted what a function RETURNED rather than what the
system DID:

- a deck-authorization test that matched source text and would have passed with
  the `founder_id` filter deleted;
- a badge test that counted `sr-only` spans in markup where `aria-label`
  suppressed them;
- a signing test fed synthetic rows containing a field the real query never
  selected;
- a positioning test that asserted a returned class string while Tailwind
  emitted no rule for it.

Practical rules that came out of that:

- Assert per select and per response path, never per file. "This file mentions
  signing somewhere" stayed true while three paths skipped it.
- When behaviour depends on emitted output — CSS, a served header, a rendered
  URL — verify the OUTPUT, not the input that should produce it.
- Pin render-site counts when a component must appear on several branches;
  `src/components/app-shell-continuity.test.ts` is the pattern.


### Static checks

```bash
npm run lint
npm run build
```

Run focused test scripts exposed in `package.json`, including event, invitation, reviewer, nudge, and dashboard suites when relevant.

### Browser checks

Use Playwright for repeatable flows and real Chrome for authenticated/manual and media-device behavior. Capture:

- viewport;
- account role;
- URL;
- actions;
- console errors;
- failed network requests;
- screenshot or trace for failures.

### Core founder journey

```text
Invitation -> Sign in with invited email -> Profile/startup setup
-> Record/upload -> Processing -> Publish -> Feed playback
-> Receive feedback -> View feedback -> Record better take -> Best Take
```

### Core reviewer journey

```text
Invitation -> Sign in -> Review queue -> Watch/seek/replay
-> Submit structured feedback -> Assignment completes -> Usefulness can be rated
```

### Core organizer journey

```text
Invitation -> Sign in -> Create event -> Invite team/founders
-> Founder joins -> Founder practices/submits -> Team reviews dashboard
-> Announcement -> Final take/report
```

### Platform admin journey

```text
Admin sign in -> Invite founder/organizer/reviewer -> Revoke/resend
-> Inspect platform state -> Confirm unauthorized user is denied
```

## 13. Migration Procedure

Before applying:

1. Inspect migration order and dependencies.
2. Confirm target Supabase project.
3. Run migration status/list.
4. Review SQL for destructive operations, locks, recursion, and policy gaps.
5. Define rollback or forward-fix strategy.

After applying:

1. Confirm migration history.
2. Query expected schema objects.
3. Test RLS allow/deny cases.
4. Run affected APIs.
5. Run browser acceptance flows.

Never apply a migration to both environments in one opaque command sequence. Record staging and production outcomes separately.

## 14. Release Procedure

### Before commit

- review `git diff` and `git diff --check`;
- ensure generated artifacts and local recordings are not staged;
- run relevant lint, build, tests, security checks, and browser QA;
- update canonical docs when behavior or architecture changes.

### Staging

1. Merge or fast-forward into `test-env`.
2. Push `test-env`.
3. Confirm Vercel deployed the expected commit.
4. Apply staging migration, if required.
5. Test affected roles and viewports against staging.
6. Resolve findings before promotion.

### Production

1. Promote the verified commit to `main`.
2. Push `main`.
3. Confirm production deployment and commit.
4. Apply production migration, if required.
5. Run a minimal canary: auth, feed, playback, feedback, invitation, and affected flow.
6. Monitor logs and provider dashboards.

### Rollback

- Prefer reverting the application commit when schema is backward compatible.
- Prefer a forward-fix migration over destructive rollback after data writes.
- Disable risky integrations with configuration only when a documented flag exists.
- Communicate the exact affected environment and user impact.

## 15. Definition of Done

A task is done only when:

- approved behavior is implemented;
- relevant mobile and desktop states are polished;
- authorization and RLS have allow/deny coverage;
- loading, empty, error, retry, and success states exist;
- tests, lint, and build pass as applicable;
- migrations are applied and verified where required;
- staging has been tested for release work;
- canonical documentation reflects the result;
- commit and deployment references are known;
- residual risks are stated.

“Code written” and “PR opened” are intermediate states, not completion.

## 16. Debugging and Incident Workflow

1. Reproduce before editing.
2. Capture console, network, server, and provider evidence.
3. Identify the failing boundary: UI, API, auth, RLS, database, email, video, or deployment.
4. Compare expected and actual payload/state.
5. Fix the root cause, not only the displayed symptom.
6. Add a regression test.
7. Verify in the environment where the issue occurred.
8. Check adjacent roles and flows for the same failure pattern.

For a production incident, prioritize containment and data safety over redesign.

## 17. Efficient Agent Behavior

- Search with `rg` before broad file reading.
- Read independent files in parallel.
- Time-box investigations and report concrete evidence.
- Avoid repeated deployment polling without a new signal.
- Use one source of truth for task status.
- Do not rerun expensive test suites when an unchanged result already covers the same commit.
- Keep user updates short and factual every meaningful milestone.
- Stop long-running sessions only after required processes are complete or safely terminated.

## 18. Handoff Template

Use this when another agent or future session continues the work:

```markdown
# Objective

# Latest user decision

# Repository/worktree/branch

# Current commit and remote state

# Completed

# In progress

# Pending

# Files changed

# Migrations and target environments

# Tests run and results

# Browser roles/viewports tested

# Known risks/findings

# Exact next action
```

Avoid chronological chat summaries. Preserve decisions, current state, evidence, and the next executable action.

## 19. Documentation Maintenance

Update the product handbook when changing:

- product positioning or persona scope;
- a core workflow;
- role permissions;
- status of a major capability;
- architecture or provider strategy;
- roadmap or launch gates.

Update this handbook when changing:

- branch/worktree conventions;
- release process;
- test strategy;
- environment topology;
- agent orchestration or evidence requirements.

Supporting documents in `docs/agent/` may contain deeper runbooks. Mark stale snapshots rather than letting conflicting guidance remain silently authoritative.
