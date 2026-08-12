# Pitch Standard and Founder Pitch Plan Integration

Status: approved implementation plan
Target branch: `codex/pitch-plan-integration`
Baseline: production `origin/main` at `61eff38`
Product north star: structured feedback produces a sharper next pitch.

## Problem

Pitch guidelines exist, but they are visually and behaviorally secondary. New events receive browser-only default guideline values, organizers must discover and publish them from the dashboard, founder preparation is separated into a generic six-field brief, and the recording studio does not expose the event standard except for an optional feedback-derived practice focus. The product therefore behaves like a recorder with guidelines attached instead of a guided pitch-improvement system.

## Confirmed Product Premises

The user approved these premises on 2026-08-12:

1. The guideline is the event's pitch contract, not optional explanatory content.
2. One immutable event-owned version must drive organizer setup, founder preparation, recording cues, reviewer feedback, and later improvement tracking.
3. Event creation must remain short; setting the pitch standard is the second setup step rather than a large form inside event basics.
4. Defaults must use plain, category-neutral language and work for technology, local business, nonprofit, creative, research, student, and social-impact pitches.
5. Future AI guidance must use the same event standard and version provenance rather than a separate schema.
6. The interface stays visually quiet: the full plan is one tap away during recording, while the camera shows at most one optional cue.

## Outcome

An organizer can create an event, invite the cohort, and accept or adapt a recommended pitch standard before founders begin recording. A founder sees the same published standard as an actionable Pitch plan before and throughout recording. A reviewer evaluates the take against that exact version. Every role sees one obvious next action.

## Role Language

| Role | Visible term | Meaning |
|---|---|---|
| Organizer | Pitch standard | What success requires for this event |
| Founder | Pitch plan | What to prepare and cover |
| Reviewer | Review focus | What to observe and improve |

The database and API retain guideline terminology where changing it would add migration risk. Role language changes at the presentation boundary.

## Universal Content Model

The default standard asks six category-neutral questions:

1. Who is this for?
2. What need, problem, or opportunity exists?
3. What are you offering or proposing?
4. Why should the audience believe it?
5. What do you want them to do next?
6. Can you communicate it clearly within the time?

This release ships one universal starting standard. Organizers adapt its wording and criteria per event. Additional goal-based starting templates are created only after repeated organizer edits show a stable need. Any future templates are internal starting points, not representations of official YC, a16z, Techstars, or other branded standards.

## Organizer Journey

### Step 1: Event basics

Keep the current short form. Do not add guideline editing or a template selector to event basics.

### Step 2: Set the pitch standard

After event creation, route to a dedicated setup state in the event dashboard:

- Show the recommended standard as six compact read-only rows.
- Primary action: `Use and publish this standard`.
- Secondary action: `Customize`, which enters an explicit editable draft mode with `Save draft` and `Publish`.
- Show `Preview founder experience` before publication.
- Allow organizer-team invitations while the standard is a draft.
- Founder invitations remain available so organizers can form the cohort while preparing the standard. Invited founders see `Pitch standard in preparation` and cannot start an event recording or submit against an undefined standard.

### Ongoing organizer state

The dashboard's primary action changes with event state:

1. Draft standard: Review and publish pitch standard; founder invitation remains a secondary action.
2. Published: show lightweight reviewer coverage, such as `3 of 6 review commitments`, with `Invite reviewers`; warn but do not hard-gate founders.
3. Published, no founders: Invite founders.
4. Founders, no takes: Check pitch readiness or send reminder.
5. Takes awaiting feedback: Coordinate reviews.
6. Feedback received: See improvement progress.

Published versions remain immutable. Editing a published standard creates a server-side draft for the next version. Publication clearly warns that new takes use the new version while historical takes and feedback remain bound to their original version.

## Founder Journey

### Event page

Replace separate guideline and pitch-brief sections with one `Your pitch plan` component placed directly before the main record/upload action. It shows:

- Last-updated date and six standard items with concise explanations; version number stays in secondary details.
- Preparation progress.
- Existing brief fields grouped beneath the closest criterion: tagline under offering, problem under need, business description under offering, and ask under next action. Stage and industry are optional context. Audience, credibility, and delivery remain preparation/review prompts without invented response fields.
- One dominant next action: continue preparing, record practice take, or submit final take.

On mobile, show a compact summary, one expanded current item, and collapsed completed/upcoming items. Use one sticky or terminal CTA, never a CTA per criterion.

Practice recording remains available before all required preparation fields are complete. Final event submission remains gated and states exactly what is missing.

### Recording studio

Load a compact, immutable recording snapshot containing the event name, guideline version, criteria, brief progress, and selected feedback practice actions.

- Choose/upload: show a dismissible `Before you record` checklist automatically once per event guideline version. The persistent `Pitch plan` control always remains available.
- Record: show at most one founder-selected cue. While actively recording, disable the full-plan control with `Available after this take`; never silently pause or alter the recording timer.
- Preview: show the plan control and a lightweight self-check, without forcing extra form completion.
- Details/final submission: render and save missing required preparation fields inside the studio. Do not navigate away from an in-memory upload. After pitch creation, reuse the existing pending-submission identity so submission or action-linking failures retry without re-upload.
- If a newer standard appears mid-session, use `Keep recording with the plan you started` as primary and `Restart with updated plan` as secondary. Restarting may discard only an unsaved current recording; it never discards an uploaded take.
- All modes preserve video, upload, and form state when the plan drawer opens or closes.

A browser reload before pitch creation still loses an in-memory upload, matching current recorder behavior; the studio warns founders to keep the tab open during upload/processing. Durable pre-pitch upload recovery is deferred because it requires a separate draft-pitch lifecycle. Once the pitch exists, reload and retry are required to recover through the existing pending-submission mechanism.

## Reviewer Journey

Retain the current criterion-linked structured feedback contract, but label the section `Review focus`. The criteria and guidance must come from the pitch's bound guideline version, never the event's newest version. Feedback retains observation, next step, disclosure mode, reviewer identity, role, criterion key, and guideline version.

## Data and API Changes

1. Add one server-persisted mutable draft per event, separate from immutable published versions. The row is unique on `event_id`, has an integer `revision`, and is readable/writable only by event owner, organizer, or admin. Founders, coaches, mentors, and judges cannot read drafts.
2. Keep the existing founder-brief storage for this pilot. Present its fields in category-neutral language, make stage and industry optional, and defer a generic event-defined field system until real events require it.
3. Expose bounded contracts: current published standard, organizer draft, immutable version by ID, and recording-session snapshot. Do not return all versions with `select('*')` on ordinary founder/reviewer paths.
4. Draft update requires the last-read `revision`; stale writes return `409 draft_changed` with reload/reapply guidance. Publishing consumes a specific revision plus an idempotency key inside the existing event lock. Success creates one immutable version and resets the draft to an editable copy of that version at the next revision. Duplicate retries return the already-created version.
5. Replace multi-write event creation with one fixed-`search_path` security-definer RPC that atomically creates the event, organizer participant, and universal draft under the existing creation idempotency key. No orphan event or organizer-less event is an accepted state.
6. Add an `event_recording_sessions` row created by a manager/member-authorized RPC when the studio opens. It stores opaque ID, event, founder, exact guideline version, issued time, and expiry. Pitch creation accepts the opaque session ID, verifies founder/event/expiry, consumes it for that pitch, and binds that exact event/version/founder tuple. Session expiry applies until successful pitch creation only; afterward the pitch's immutable binding is authoritative for final-submission retries. For structured events, database triggers and submission code fail closed when the trusted binding is missing or mismatched; they never fall back to the event's current version.
7. Replace final event submission's separate writes with one transaction-backed RPC. It validates active founder membership, event status/deadline, required brief fields, pitch ownership, the pitch's trusted event/version/founder binding, and privacy; then idempotently upserts the submission atomically. A retry after the original recording session expires remains valid because it cannot change the pitch's consumed binding.
8. Keep all manager authorization server-side. Security-definer functions use fixed `search_path`; clients cannot mutate published versions directly.

### State and data flow

```text
CREATE EVENT
request + creation key
  -> create_event_with_standard_draft() transaction
       -> pitch_events
       -> organizer participant
       -> event guideline draft revision 1
  -> event dashboard setup

DRAFT / PUBLISH
draft rN --save with expected rN--> draft rN+1
draft rN --publish + idempotency key--> immutable version V
                                      -> event.current_version = V
                                      -> editable draft copied from V at rN+1
stale revision ----------------------> 409 draft_changed, no overwrite

FOUNDER LOOP
published V -> recording-session S(event, founder, V, expiry)
            -> pitch creation validates S -> pitch bound to V
            -> atomic final-submit validates brief + S + V
            -> reviewer loads V from pitch, not current event
            -> feedback criterion on V
            -> selected action -> later session/take -> before/after assessment
```

### Draft lifecycle

```text
recommended draft -> editing -> publishing -> published V
       ^                |           |             |
       |                +--409------+             +-> editable copy for V+1
       +-------- retry after load ----------------+
```

`publishing` is transaction-local, not a durable user-visible limbo state. A failed transaction leaves the previous draft revision intact. The UI disables repeat actions while pending, but server idempotency is authoritative.

## Migration and Compatibility

- Existing structured events keep their published versions unchanged.
- Existing `legacy_open` events receive an organizer prompt to create a pitch standard; they are not silently activated.
- Existing founder briefs remain readable and editable without a schema conversion.
- Existing practice takes and feedback retain their current version bindings.
- Public/non-event recording behavior is unchanged.
- Rollout is additive. Existing founder-brief columns are not dropped or generalized in this release.

Deployment sequence:

1. Expand: add draft and recording-session schema, indexes, RPCs, and dual-compatible read APIs.
2. Deploy writers that always create recording sessions and persist exact guideline versions while legacy-open events retain their old behavior.
3. Verify structured-event null/mismatch counts are zero and test cross-event/session rejection in staging.
4. Enforce fail-closed structured-event triggers and atomic final submission.
5. Deploy UI setup and recording gates.

Rollback retains draft, session, and exact-version rows. Application rollback must not restore silent fallback-to-current behavior for structured events.

## Accessibility and Responsive Behavior

- Keyboard-visible focus, semantic headings, labelled dialogs/drawers, Escape close, and focus return.
- No drawer may open over an active recording without a clear pause/stop behavior.
- Minimum 44px touch targets.
- Mobile shows one column and a bottom-sheet plan; desktop uses a constrained side drawer.
- The bottom sheet prevents background scrolling and respects safe-area padding.
- Reduced-motion preferences remove nonessential countdown/transitions; screen readers announce countdown, recording start/stop, upload preservation, and submission recovery.
- Long organizer guidance wraps without horizontal scrolling.
- Loading, empty, offline/save failure, validation, publish success, and version-conflict states have explicit copy and recovery actions.

## What Already Exists

| Need | Existing foundation | Plan treatment |
|---|---|---|
| Immutable standards | `event_pitch_guideline_versions` and publication RPC | Preserve and extend publication to consume a draft revision/idempotency key |
| Founder preparation | `event_founder_pitch_briefs` and founder-brief API | Reuse storage; reorganize presentation and enforce inside atomic final submission |
| Pitch provenance | Pitch/submission guideline-version columns and triggers | Remove structured-event fallback and bind through a trusted recording session |
| Structured feedback | Criterion, observation, next step, disclosure, and guidance actions | Reuse; ensure reviewer reads the pitch-bound version |
| Upload/submission recovery | Recording studio pending event submission identity | Reuse after pitch creation; keep missing brief completion inside the studio |
| Organizer access | `is_event_manager` and existing participant roles | Reuse owner/organizer/admin boundary for draft read/write |
| Review supply | Existing review assignments and organizer coordination UI | Add a lightweight coverage warning and manual pilot operating contract, not allocation v2 |

## Implementation Slices

### Slice 1: Domain contract and persistence

- One category-neutral universal default.
- Server-side draft tables, RLS, validation, and publish transition.
- Explicit recording-session guideline version and server validation.
- API tests, migration/RLS tests, and rollback notes.

### Slice 2: Organizer setup and state-driven dashboard

- Dedicated post-create pitch-standard setup.
- Draft editing, preview, publishing, and new-version flow.
- Founder invite state explains when the pitch standard is still being prepared.
- Limit dashboard changes to the primary draft/publish action needed for this loop.

### Slice 3: Founder Pitch plan and recording integration

- Consolidated event Pitch plan and progress.
- Reusable read-only plan drawer/sheet.
- Recording snapshot loading and version binding.
- Before-record checklist, single cue, preview self-check, and final-submit rescue path.
- Preserve uploaded takes when preparation is incomplete.

### Slice 4: Reviewer wording and version correctness

- Review focus presentation.
- Verify pitch-bound version loading across reviewer entry points.
- Regression tests for event version changes after a pitch is recorded.

### Slice 5: Documentation and measurement

- Product spec, roadmap, release notes, and agent guidance.
- Analytics events: draft created, standard published, founder plan viewed, first recording started, feedback viewed, guidance selected, later take recorded, later take linked, and improvement assessed.
- No new analytics vendor or AI integration.

## Test Plan

- Unit: universal-default construction, draft validation, required-field progress, and version-conflict decisions.
- API: organizer-only draft mutation, event member published reads, bounded payloads, invalid criteria, idempotent event/draft creation, publish version increment, founder preparation state, and reviewer-coverage warning data.
- Database: RLS actor matrix, immutable versions, fixed-search-path functions, event creation atomicity, stale draft revision, simultaneous/duplicate publication, and atomic final submission.
- Component: organizer setup states, Pitch plan progress, drawer focus management, recording cue behavior, failure recovery.
- Integration: create event to invite to publish; founder sees preparation state, then prepares, practices, and submits; reviewer loads the pitch-bound version; organizer publishes v2 while a v1 recording is in progress; trusted reviewer completes a before/after comparison.
- Browser: signed-in organizer and founder flows on mobile and desktop in staging.
- Regression: public recording, legacy events, current Toast/Roast, private video access, event invitations, and existing structured feedback.

Critical assertions:

- Reject cross-event version/session injection and another founder's recording session.
- Reject expired, missing, replay-incompatible, or tampered recording-session IDs.
- Retry final submission successfully after the consumed recording session expires, while rejecting any attempt to reuse that session for another pitch.
- Reject arbitrary historical-version selection without a matching server session.
- Reject direct final submission with incomplete required brief fields.
- Replay event creation after each simulated sub-write failure without duplication or orphan rows.
- Return `409` for stale draft revision and deterministic success for duplicate publish idempotency keys.
- Preserve V1 during upload when V2 publishes; reviewer subsequently loads V1 from the pitch.
- Keep the uploaded take in studio memory while missing brief fields are completed.
- Recover after pitch creation when final submission or guidance-action linking fails.
- Assert current/draft/version/session lookups use bounded queries and indexed keys; no per-criterion query loop is allowed.

## Success Measures

- Primary: at least 50% of eligible later takes are independently rated better than their source take against the same criterion set, using a blinded organizer or trusted-reviewer comparison.
- Record criterion-level before/after deltas, cohort denominator, and a two-week observation window.
- At least 90% of new events publish a pitch standard before the first founder starts an event recording.
- At least 80% of founders view the Pitch plan before their first event recording.
- At least 70% complete the organizer-required preparation items.
- At least 70% of active pitches receive structured feedback within 48 hours.
- At least 60% of founders publish a later take.
- At least 50% of later takes address a selected guidance item.
- Founder-reported usefulness is supporting evidence, not proof of improvement.

## Pilot Reviewer-Supply Contract

- Before founders record, each organizer nominates enough organizers, mentors, advisors, or trusted founders to guarantee at least two reviews per founder.
- Manual assignment and reminders are acceptable for the pilot; this release does not redesign reviewer incentives.
- Track active-reviewer-to-founder ratio, reviewer invite acceptance, assignment completion, median feedback latency, and reviewer return rate.
- Do not invest in allocation v2 or reviewer credits until the manual supply process meets the coverage target and coordination itself becomes the measured constraint.

## NOT in Scope

- AI-generated or AI-scored guidance.
- Official branded accelerator templates.
- Additional template library, template marketplace, or public template sharing.
- Generic organizer-defined preparation-field schema.
- Reviewer allocation v2, credits/karma redesign, or large-cohort optimization.
- Dropping legacy founder-brief columns.
- Broad event automation or payment flows.

## Risks and Rescue Paths

| Risk | User impact | Rescue |
|---|---|---|
| Organizer abandons setup | Invited founders cannot start an event recording | Save draft server-side, show one-click recommended publication, and explain that the standard is being prepared |
| Template language feels sector-specific | Nontechnical founders cannot map their work | Use universal questions; move specialized fields to optional requirements |
| Guideline changes during recording | Review criteria and founder intent diverge | Bind a recording snapshot and require explicit refresh/restart or retain prior version |
| Founder is blocked after upload | Video work appears lost | Save as practice, retain upload, link to missing plan fields, retry only submission |
| Draft publication partially fails | Event is created but setup appears broken | Idempotent draft initialization and dashboard repair action |
| Too much recording chrome | Founder loses focus | One compact control and one selected cue; full plan only on demand |
| Existing brief behavior regresses | Current founders lose saved preparation | Retain the six-column contract and test existing reads/writes unchanged |
| Too few reviewers participate | Founders never complete the improvement loop | Require a pilot reviewer roster and manually guarantee two reviews per founder |
| Two organizers overwrite a draft | One organizer's standard changes disappear | Revision/ETag conflict returns 409 and preserves both users' source text for reapply |
| Old or cross-event session is injected | Pitch is reviewed against the wrong standard | Server-owned session verification and fail-closed atomic submission |
| Final submission fails after pitch creation | Founder believes the upload was lost | Persist pending pitch identity and retry only the failed linking/submission operation |

## Delivery Gate

After implementation: run frontend QA, security audit, performance checks for affected endpoints, full ship review, staging migration, signed-in organizer/founder/reviewer browser verification, canary monitoring, and release documentation. Production promotion requires staging acceptance and migration verification.

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 1 | Intake | Keep event basics short and make Pitch standard a required second setup state | Mechanical | Explicit over clever | Preserves fast creation while making the core value proposition unavoidable | Large guideline form inside event basics |
| 2 | Intake | Use universal questions plus goal-based templates | Mechanical | Completeness | Supports nontechnical and non-venture contexts without losing investor use cases | Investor-first universal schema |
| 3 | Intake | Persist mutable drafts separately from immutable published versions | Mechanical | Explicit over clever | Draft collaboration and recovery cannot safely reuse immutable history rows | Browser-only localStorage draft |
| 4 | Intake | Consolidate guidelines and founder brief into one Pitch plan | Mechanical | DRY | Founders should not reconcile two representations of the same preparation contract | Separate guideline and brief cards |
| 5 | Intake | Defer AI generation and branded templates | Mechanical | Pragmatic | The event contract must work before AI is layered on it | AI scope in this release |
| 6 | CEO | Make independently assessed before/after improvement the primary metric | Mechanical | Completeness | Repeat recording and self-reported completion do not prove a sharper pitch | Activity-only success metrics |
| 7 | CEO | Keep invitations open but gate event recording until publication | Taste | Bias toward action | Organizers can form a cohort without letting founders record against an undefined standard | Queueing all founder invitations |
| 8 | CEO | Retain the existing founder-brief schema for the pilot | Mechanical | Pragmatic | Arbitrary field definitions add platform complexity before demand is proven | Generic event-defined field system |
| 9 | CEO | Ship one universal default and learn templates from organizer edits | Mechanical | Focus as subtraction | Per-event editable criteria satisfy the requirement without six speculative templates | Full template library in this release |
| 10 | CEO | Add a manual reviewer-supply operating contract | Mechanical | Completeness | The improvement loop fails if no reviewer arrives, even when guidance UX is excellent | Assuming existing assignments guarantee supply |
| 11 | Design | Present the universal standard read-only before customization | Mechanical | Subtraction default | Most organizers get a one-click path while editing remains explicit | Editable rows plus a competing Customize action |
| 12 | Design | Disable the full plan during active recording | Mechanical | Design for trust | Opening guidance must never surprise founders by pausing or corrupting timing | Automatic recording pause |
| 13 | Design | Map existing brief fields to criteria without inventing new inputs | Mechanical | Explicit over clever | The pilot can present one coherent plan without a premature field schema | One response field for every criterion |
| 14 | Design | Surface reviewer coverage as a warning, not a hard gate | Taste | Hierarchy as service | The organizer sees the supply risk while retaining pilot flexibility | Invisible manual reviewer contract or blocking workflow |
| 15 | Engineering | Create event, organizer participant, and default draft in one RPC transaction | Mechanical | Systems over heroes | Removes the existing partial-state seam before adding another dependent write | Best-effort repair after independent writes |
| 16 | Engineering | Use a server-persisted recording session as the trusted version snapshot | Mechanical | Explicit over clever | A client-provided version UUID cannot prove which standard governed the recording | Fallback to current guideline or arbitrary UUID |
| 17 | Engineering | Make final event submission one atomic RPC | Mechanical | Completeness | UI checks and separate writes cannot enforce the product contract | Client-side validation plus multi-write route |
| 18 | Engineering | Use revision-based optimistic concurrency for the single event draft | Mechanical | Boring by default | Explicit 409 conflicts prevent silent organizer overwrites | Last-write-wins draft updates |
| 19 | Engineering | Complete missing brief fields inside the studio | Mechanical | Minimal diff | Preserves the upload without introducing a draft-pitch subsystem | Navigation away or new durable draft-pitch lifecycle |

## Cross-Phase Review Themes

- **Prove improvement, not activity.** Strategy and engineering both require the same immutable standard to support a credible before/after comparison.
- **Provenance is the load-bearing contract.** Design needs founders and reviewers to see the right standard; engineering therefore uses a trusted recording session and pitch-bound immutable version.
- **Reviewer supply remains operational during the pilot.** The UI surfaces coverage, while the operating contract guarantees reviews without expanding into allocation-v2 infrastructure.
- **Subtraction protects the pilot.** One universal editable standard and the existing brief replace speculative template and arbitrary-field platforms.

## Implementation Tasks

- [ ] **T1 (P0)** — Add atomic event creation, single-row revisioned drafts, and idempotent publication.
- [ ] **T2 (P0)** — Add trusted recording sessions and remove structured-event fallback to the current guideline.
- [ ] **T3 (P0)** — Replace final event submission with one atomic, idempotent validation RPC.
- [ ] **T4 (P1)** — Build the organizer review/customize/publish flow and reviewer-coverage warning.
- [ ] **T5 (P1)** — Consolidate founder guidance and brief fields into the compact Pitch plan.
- [ ] **T6 (P1)** — Integrate persistent plan access and one selected cue into recording without altering active recording.
- [ ] **T7 (P1)** — Make reviewer entry points load criteria from the pitch-bound version.
- [ ] **T8 (P1)** — Add before/after assessment and the complete pilot measurement funnel.
- [ ] **T9 (P1)** — Update product spec, roadmap, agent guidance, migrations, rollback notes, and release documentation.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---:|---|---|
| CEO Review | `/autoplan` | Scope and strategy | 2 | CLEAR | 8 findings resolved; scope narrowed to an evidence-producing pilot loop |
| Codex CLI Voice | `/autoplan` | Independent cross-model review | 1 | UNAVAILABLE | Installed CLI cannot run the configured model until upgraded |
| Eng Review | `/autoplan` | Architecture, security, tests, and deployment | 2 | CLEAR | 9 findings resolved; no critical gaps remain in the plan |
| Design Review | `/autoplan` | Organizer, founder, reviewer, and recording UX | 2 | CLEAR | 9 findings resolved; no design blockers remain |
| DX Review | `/autoplan` | Developer-facing experience | 0 | SKIPPED | No developer-facing product scope |

**VERDICT:** CEO + DESIGN + ENG CLEARED. Ready for implementation after user approval of this reviewed plan.

NO UNRESOLVED DECISIONS
