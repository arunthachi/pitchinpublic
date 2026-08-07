# Pitch in Public Product Handbook

Status: Canonical product specification
Audience: Product, design, engineering, operations, organizers, and coding agents
Last reviewed: 2026-08-03
Applies to: Pitch in Public web app, marketing site, organizer tools, reviewer tools, and platform administration

This handbook is the product source of truth. It distinguishes current product behavior from planned work. Code, database migrations, and deployed configuration remain the final authority for what is actually running.

## 1. Executive Summary

Pitch in Public is a mobile-first pitch practice platform where founders repeatedly record a short pitch, receive structured feedback, improve the next version, and select a best take.

The product is not primarily a startup discovery network or "TikTok for startup ideas." The vertical video feed is an interaction model, not the product's value proposition.

The core promise is:

> Practice your pitch, get useful feedback, and become clearer and more confident with every take.

The core loop is:

```text
Record -> Get useful feedback -> Improve -> Repeat -> Select Best Take
```

The organizer wedge extends that loop:

```text
Create event -> Invite founders and team -> Practice toward a deadline
-> Review progress -> Submit final takes -> Run a stronger pitch event
```

## 2. Vision, Mission, and Positioning

### Vision

Every builder should be able to explain what they are building clearly, confidently, and compellingly.

### Mission

Turn pitching from an occasional high-pressure performance into a repeatable practice habit supported by constructive human feedback.

### Category

Pitch practice and feedback platform for founders and founder programs.

### Primary positioning

```text
A pitch gym where founders record, get Toast or Roast feedback, improve, and build confidence.
```

### Founder value proposition

- Practice without waiting for pitch day.
- Learn where listeners lose clarity.
- Receive specific, structured signals instead of vague encouragement.
- Compare versions and choose a best take.
- Build confidence through repetitions, not theory alone.

### Organizer value proposition

- Turn the weeks before an event into a guided pitch practice program.
- Set pitch length, deadline, and focus areas.
- Invite founders, coaches, mentors, judges, and administrators.
- See participation, submissions, feedback coverage, and final takes.
- Communicate with the cohort and reduce manual follow-up.

### What PiP is not

- A generic founder social network.
- An investor marketplace.
- A repository for stealing or discovering startup ideas.
- A vanity leaderboard based on popularity.
- A replacement for an event organizer's full CRM or ticketing system.
- A video entertainment product optimized for passive consumption.

## 3. Product Strategy

### Initial market

The first market has two connected audiences:

1. Founders and builders who need regular pitch practice.
2. Pitch competitions, accelerators, cohorts, demo days, founder programs, and networking events that need participants to arrive prepared.

### Go-to-market sequence

1. Run a controlled, invite-only founder cohort.
2. Prove that founders record, give feedback, improve, and return.
3. Run one organizer-led event with real deadlines and submissions.
4. Convert the proven ritual into a paid four-week sprint or organizer program.
5. Open access gradually only after review supply and moderation can support demand.

### Controlled pilot model

Recommended first pilot:

- 10 to 20 founders.
- Two weeks.
- Invite-only.
- First take in week one; better take in week two.
- At least three useful feedback responses per pitch.
- Manual onboarding, reminders, moderation, and featured selections are acceptable.

### Paid validation

Recommended follow-on:

- Four-week Pitch Without Fear Sprint.
- Up to 20 founders.
- Founding price target: $49 per founder.
- Weekly practice themes and one public-ready Best Take.

### Leading indicator

The leading indicator is not total signups or video views. It is review supply relative to submitted pitches, weighted by usefulness.

```text
Useful feedback coverage = pitches receiving enough useful feedback / pitches requesting feedback
```

If founders post but do not receive useful feedback, the product fails even if traffic grows.

## 4. Product Principles

### 4.1 Video is the practice surface

The pitch video must remain the primary visual object. Navigation, gamification, metadata, and feedback controls must not overpower it.

### 4.2 Improvement beats performance theater

The product should reward repetitions, clearer versions, useful reviews, and a stronger Best Take. It should not reward empty popularity.

### 4.3 Useful feedback is a marketplace

Founders want feedback more than they want to provide it. PiP must actively balance supply and demand through assigned queues, reciprocity, low-friction structure, usefulness ratings, and organizer participation.

### 4.4 Mobile-first is mandatory

Most founders will record and review on a phone. Every workflow must work at common mobile widths, with touch targets, safe-area support, keyboard behavior, scroll containment, and camera/microphone permissions tested on real mobile browsers.

### 4.5 One obvious next action

Every high-frequency screen should answer: "What should I do now?" Founders should not hunt through dashboards to record today's rep or review an assigned pitch.

### 4.6 Invite-only until density is reliable

The marketing site can remain public, but product access should remain controlled during the founding cohort. Invites create review density, improve moderation, and let the team talk to every user.

### 4.7 Roles coexist on one identity

One authenticated person may be a founder, organizer, coach, mentor, judge, administrator, or trusted reviewer. Roles are capabilities and memberships, not separate user accounts.

### 4.8 Progressive disclosure

Show the next relevant choice, not every capability. Detailed progress, achievements, event analytics, and administration belong in dedicated surfaces, not around every video.

## 5. Personas and Roles

### Founder or builder

Primary job: improve a pitch through repeated recorded takes and useful feedback.

Needs:

- Fast onboarding.
- One-tap access to recording.
- A clear daily prompt or event goal.
- Structured feedback that is easy to act on.
- Version history, progress, and Best Take.

### Peer reviewer

Primary job: evaluate another founder's pitch and provide a useful signal.

Motivation:

- Reciprocity and review credits.
- Learning by evaluating pitches.
- Community contribution and reputation.

### Trusted reviewer

Examples: investor, experienced founder, product leader, accelerator staff, coach, or past judge.

Primary job: review pitches without needing to post a pitch.

Motivation:

- Deal flow or early exposure.
- Status and contribution.
- Helping a specific program or founder cohort.

### Organizer

Primary job: create and manage a pitch event or practice program.

Needs:

- Invite-only onboarding.
- Event setup and editing.
- Founder and team invitations.
- Submission and progress review.
- Announcements and reminders.
- Outcome reporting.

### Organizer team roles

- Admin: manage the event, team, founders, submissions, and communications.
- Organizer: manage the event and operating workflow.
- Coach: view founders and help with practice.
- Mentor: view founders and provide guidance.
- Judge: review eligible submissions and final takes.

Exact permissions must be enforced server-side and by row-level security, not only hidden in the UI.

### Platform super admin

Primary job: control private platform access and oversee organizers, founders, reviewers, events, and invitations.

The administrative route is `/pip-super-admin`, but route obscurity is not a security control. Authentication and explicit platform-admin authorization are required.

## 6. Jobs to Be Done and Use Cases

### Founder jobs

1. When someone asks what I am building, help me explain it clearly in under the allowed pitch time.
2. When I have an upcoming pitch event, give me a practice plan and deadline-driven momentum.
3. When I record a take, tell me where the message is clear or weak.
4. When I improve a take, let me compare versions and select the strongest one.
5. When I help another founder, make the review fast, structured, and worthwhile.

### Organizer jobs

1. Create a pitch event with the correct duration, deadline, and practice focus.
2. Invite founders and staff without requiring them to remember codes.
3. Know who joined, practiced, received feedback, and submitted a final take.
4. Communicate deadlines and instructions to participants.
5. Review submissions with the full event team.
6. Export or present an outcome summary for the program.

### Reviewer jobs

1. See a small assigned queue rather than an endless feed.
2. Give a useful review in roughly 45 to 90 seconds.
3. Review all eligible pitches when granted platform-wide scope.
4. Build a reputation based on founder-rated usefulness, not review volume alone.

## 7. Core Experience Specifications

### 7.1 Authentication and access

Current direction:

- Google sign-in is the fastest primary option.
- Email OTP is the non-social fallback.
- Phone authentication is deferred.
- App access is invite-only during the founding cohort.
- Existing invited users must continue to sign in after accepting an invitation.
- Invitation links do not replace authentication.

Required behavior:

- An unauthenticated invitation recipient sees the event or role context and one clear action to sign in or create an account with the invited email.
- After authentication, the invitation is accepted explicitly or automatically only when the authenticated email matches the addressed invite.
- Existing users retain all existing roles and history when joining an event or accepting another role.
- Authentication failures must show actionable, non-technical messages.
- A loading state must time out into a recoverable error rather than spin indefinitely.

### 7.2 Founder onboarding

MVP supports one active startup per founder in the UI, while the data model should allow multiple startups later.

First-use information:

- Display name.
- Role or bio.
- Startup name.
- One-line pitch.
- Website or LinkedIn.
- Default feedback focus.

Startup data belongs to the startup/profile setup and should prefill future pitch uploads. Recording a new take should ask only for information that changed or is take-specific.

### 7.3 Recording and upload

Required:

- Record from phone or desktop camera.
- Upload an existing video.
- Support portrait video as the recommended format.
- Show a clear timer and minimum/maximum duration constraints before recording.
- Stop, preview, retake, and upload must work without hidden gestures.
- Upload progress must be real and recover from failures.
- Processing state must distinguish uploading, processing, ready, and failed.
- The preview and published confirmation must show the recorded video.
- Event-associated recording uses the event's configured pitch length.

Video policy:

- Recommended aspect ratio: portrait 9:16.
- Other formats may be accepted only when rendered without breaking the feed.
- File-size and duration validation must occur before upload where possible and on the server always.
- Exact limits must be defined in code and displayed before selection; do not leave them implicit in documentation alone.

### 7.4 Pitch metadata and versions

Each pitch take should carry:

- Startup reference.
- One-line pitch or hook.
- Feedback ask/focus.
- Optional take-specific context.
- Take version.
- Best Take status.
- Optional event association.
- Visibility state.
- Public, non-sequential identifier for shareable routes.

Version labels should communicate progression: First Take, Better Take, Take 3, and Best Take. The system must not ask founders to re-enter unchanged startup information for every take.

### 7.5 Feed and playback

Required:

- Portrait video remains the center of attention.
- Videos can autoplay muted where browser policy requires it.
- The audio control must be visible and understandable.
- Users can restart or scrub using a visible progress control.
- Pitch metadata is compact and expandable.
- Reaction and feedback controls are contextual to the current pitch.
- Empty feeds show a useful empty state, not an infinite loading message.
- Desktop layouts center the video in the usable viewport, not inside one side panel.
- Mobile layouts fit safe areas and do not trap scrolling.

### 7.6 Structured feedback

Fast feedback model:

1. Choose Toast or Roast.
2. Select one to three relevant signal chips.
3. Choose readiness: Needs work, Getting there, Strong, or Pitch-ready.
4. Optionally add a note by typing or speech-to-text.
5. Submit once.

Requirements:

- Notes are optional unless a future quality rule explicitly requires one.
- Multiple signal chips are allowed, with a small maximum.
- The note field is visible by default with a microphone action inside or adjacent to it.
- Speech-to-text uses Deepgram for short feedback-note transcription.
- Feedback drawers must scroll independently on mobile and desktop.
- Submit must be idempotent and visibly pending to prevent duplicate writes.
- Users cannot submit feedback on their own pitch unless a deliberate self-review mode is introduced.
- Saved feedback must immediately appear in counts and the pitch's feedback view.
- Errors should preserve the user's selections and note for retry.

### 7.7 Feedback marketplace

The review system should treat reviewers as the supply side.

Core mechanics:

- Assigned review queue: a small number of pitches waiting for the user.
- Reciprocity: founders earn posting or review priority through useful reviews.
- Review credits: an auditable balance, not a client-only counter.
- Usefulness rating: pitch owners can mark feedback useful, generic, or not helpful.
- Reviewer reputation: based on usefulness and consistency, not raw count.
- Trusted reviewers: can review without posting a pitch.
- Optional weekly Pitch Hour: creates synchronous review density.

Design guardrail: do not force a blank essay. The structured review should be completable in under 90 seconds.

### 7.8 Progress and habit formation

Founder progress should show:

- Practice reps.
- Active practice days.
- Current run and best run.
- Recent activity heatmap.
- Feedback received.
- Best Take.
- Event deadline countdown where relevant.
- Pitch progression and repeated feedback signals.

Streaks are supportive, not punitive. A missed day must not erase the founder's sense of progress.

Daily prompt examples:

- Make the customer obvious in sentence one.
- Name one painful problem.
- End with one specific ask.
- Cut filler from the opening ten seconds.

### 7.9 Founder profile and portfolio

The founder profile should behave like a primary content page, not a narrow settings drawer.

Required:

- Display name, bio, links, and startup identity.
- Grid or list of pitch takes.
- Tabs for pitches, Best Takes, and feedback.
- Momentum summary and heatmap.
- Edit profile/startup entry point.
- Public routes must use a non-sensitive public identifier or username, not expose raw database UUIDs.

### 7.10 Pitch goals

A founder can create a goal tied to a date, such as a pitch competition three months away.

The system generates a high-level practice plan based on:

- Goal or event name.
- Pitch date.
- Pitch context.
- Primary focus areas.
- Remaining time.

The goal action must be distinct from Record Pitch. One edits or opens the plan; the other records a take.

### 7.11 Organizer onboarding

Organizer accounts are invite-only during the pilot.

Flow:

1. Platform admin sends an addressed organizer invitation.
2. Recipient opens a branded email with one clear CTA.
3. Recipient authenticates with the invited email.
4. Recipient accepts the invitation.
5. Organizer identity and organization membership are created.
6. Organizer lands on event setup or the organizer dashboard.

Do not send a request-received email when the recipient actually needs an invitation CTA. Request confirmation and access invitation are different messages.

### 7.12 Event setup

Event setup fields:

- Event/program name.
- Organization.
- Description.
- Pitch day.
- Submission deadline.
- Pitch duration, displayed in minutes. This is a primary setup field selected with one tap; it must not be hidden behind an advanced or collapsed section.
- One or more practice focus areas.
- Access model described in plain language.
- Optional access code as a fallback, not the primary invitation experience.

Supported pitch duration should include common values from one through six minutes and a safe custom option if validation permits it.

Visibility copy must explain the outcome, for example:

- Invite-only: only invited participants and event staff can access it.
- Link access: anyone with the private link can request or join according to event rules.

### 7.13 Event invitations

Founder invitation flow:

- Organizer enters emails with zero format learning: typed addresses become removable chips, pasted spreadsheet columns split automatically, and a CSV/TXT file can be uploaded. Invalid addresses are flagged inline before anything is sent.
- Recipient receives a branded email with an "View invitation" or "Join [Event Name]" button.
- Raw URLs are not the primary CTA.
- The event page displays the event name and one state-aware action.
- Unauthenticated: Sign in to accept invitation.
- Authenticated and not joined: Join [Event Name].
- Joined: Record for [Event Name] or View event dashboard.

Addressed invitations are bound to the invited email. Codes alone must not allow random founders to claim another person's seat.

### 7.14 Organizer dashboard

All authorized event team members can view submission review according to role policy.

Dashboard capabilities:

- Event overview and editable settings.
- Founder roster and invitation status.
- Team roster and roles.
- Practice and submission status.
- Final takes.
- Feedback coverage.
- Announcements.
- Outcome report.

High-priority actions must be obvious: invite founders, invite team, edit event, review submissions, and send announcement.

### 7.15 Communications and notifications

Channels for MVP:

- Transactional email.
- Scheduled email nudges.
- In-app state and notification surfaces.

SMS and push notifications are deferred until behavior is proven and operational consent is designed.

Founder nudges:

- Daily practice prompt at the user's selected local time.
- Event reminders at useful deadline intervals.
- Can be paused by the user.

Reviewer nudges:

- Lower frequency than founder nudges.
- Triggered by pending assigned reviews or review events.
- Emphasize impact and a small, bounded queue.

Organizer nudges:

- Cohort inactivity, deadlines, uncovered submissions, and incomplete final takes.
- Action-oriented, not generic engagement email.

The scheduler must run frequently enough to honor user-selected times across timezones. The current design uses an hourly sweep and a delivery window.

### 7.16 Platform administration

Platform admin capabilities:

- Invite and revoke independent founder access.
- Invite organizers.
- Invite trusted reviewers and set scope.
- View founders, organizers, reviewers, events, and pending invitations.
- Inspect delivery failures without exposing raw provider errors to end users.

Unauthenticated or unauthorized access to the admin route must show a sign-in/access screen, not render an empty admin dashboard skeleton.

## 8. Capability Status Matrix

Status definitions:

- Shipped: represented in the current codebase and migrations.
- Verify: implemented, but must pass environment-specific end-to-end verification before a pilot.
- Planned: approved direction, not safe to claim as available.
- Deferred: explicitly outside the current launch scope.

| Capability | Status | Notes |
| --- | --- | --- |
| Google authentication | Shipped | Provider configuration is environment-specific. |
| Email OTP authentication | Shipped | Redirect and invite continuity require verification. |
| Invite-only pilot access | Shipped | Code still contains an environment allowlist compatibility path; canonical direction is invitation/membership based. |
| Founder direct invitations | Shipped | Verify new-user and existing-user acceptance. |
| Organizer invitations | Shipped | Verify CTA, authentication, and landing behavior. |
| Trusted reviewer invitations | Shipped | Verify platform-wide and event-scoped access. |
| Mobile recording and upload | Verify | Core launch blocker until tested on real iOS and Android browsers. |
| Cloudflare Stream upload/playback | Shipped | Only implemented media provider. |
| Roast/Toast structured feedback | Shipped | Save, display, scrolling, duplicate prevention, and self-review protection require regression tests. |
| Feedback speech-to-text | Shipped | Deepgram short-note transcription. |
| Pitch versions and Best Take | Shipped | Verify event and personal flows. |
| Founder profile/portfolio | Shipped | Public identifier and momentum accuracy require regression tests. |
| Pitch goals and daily prompts | Shipped | Verify dates and momentum aggregation. |
| Review queue and assignments | Shipped | Review credit/economy behavior should be piloted carefully. |
| Feedback usefulness ratings | Shipped | Verify quality metrics and permissions. |
| Event creation/editing | Shipped | Verify RLS and multi-focus persistence. |
| Event team roles | Shipped | Final permission matrix requires security audit. |
| Founder event invites | Shipped | Addressed invite should be primary; codes are fallback. |
| Organizer dashboard | Shipped | Verify all team roles and mobile responsiveness. |
| Announcements | Shipped | Verify email delivery and recipient selection. |
| Scheduled nudges | Shipped | Hourly scheduler and secrets must be configured per environment. |
| PWA install support | Shipped | Real-device install and standalone behavior require verification. |
| Push notifications | Deferred | Do not block pilot. |
| SMS login/reminders | Deferred | Do not block pilot. |
| Multiple startups in UI | Planned | Schema should support future expansion; MVP UI exposes one active startup. |
| Founder pitch deck upload (PDF/PPT/Drive link) | Shipped | One optional deck per startup: PDF/PPT/PPTX (≤25MB) uploaded directly to a private Supabase Storage bucket via server-issued signed URLs, or an https link. Deny-by-default visibility: owner, active event team members of events where the founder actively participates, and platform admin — all server-mediated. Verify on staging per environment. |
| Payments/paywall | Deferred | Validate paid demand manually first. |
| Investor discovery marketplace | Deferred | Not core to the practice loop. |

## 9. Domain and Data Model

The conceptual model is:

```text
User
  -> Profile
  -> Roles and memberships
  -> Startup(s)
       -> Pitch takes
            -> Reactions
            -> Feedback
            -> Best Take state
            -> Event submission(s)

Organization
  -> Team memberships
  -> Events
       -> Founder invitations/participants
       -> Team members
       -> Announcements
       -> Review assignments
       -> Final submissions

Platform invitations/memberships
  -> Founder access
  -> Organizer access
  -> Trusted reviewer access and scope
```

Data-model rules:

- Authentication identity is separate from product profile and role membership.
- One user can hold multiple roles.
- Startup is a first-class entity; do not permanently attach startup fields only to the user.
- Event membership and platform access are separate concepts.
- Public URLs use public IDs or slugs, not raw internal UUIDs.
- Invitation codes are random, expiring, auditable, and email-bound where addressed.
- Best Take is a state on a take or an explicit relationship, not inferred from UI order.
- Review credits and reputation changes are server-side transactions.

## 10. Technical Architecture

### Application

- Next.js App Router.
- React and TypeScript.
- Tailwind CSS with Radix-based components, Framer Motion, and Lucide icons.
- Mobile-first responsive web app and PWA behavior.

### Backend and data

- Supabase Authentication.
- Supabase Postgres.
- Row-level security for user and event isolation.
- Service-role operations only in server-side modules and routes.
- SQL migrations are the only approved schema-change mechanism.

### Media

- Cloudflare Stream is the implemented video provider.
- Direct creator uploads are requested server-side.
- Processing status is polled or refreshed until ready.
- HLS playback is used where supported.
- The provider abstraction names other providers, but Mux and Bunny are not implemented and must not be presented as available.

### Email and transcription

- Resend handles transactional and scheduled email.
- Sender domain configuration is environment-specific.
- Deepgram handles short feedback-note transcription.

### Hosting and scheduling

- Vercel hosts the Next.js application.
- Scheduled nudge routes require a secret and an external or Vercel cron schedule.
- Current database scheduling includes an hourly nudge sweep migration; deployment configuration must be verified.

### Environment boundaries

Known project references:

- Staging Supabase: `lzhgazflsidkzctjlawu`
- Production Supabase: `djzlqoqgvzxqcbualsbx`

These identifiers must be verified against deployment configuration before any migration or destructive operation.

## 11. Security and Privacy Requirements

### Mandatory controls

- Authentication does not imply authorization.
- All sensitive reads and writes are checked server-side.
- RLS is enabled and tested for pitches, feedback, events, memberships, invitations, submissions, and reviewer scopes.
- Service-role keys never reach client bundles.
- Raw database UUIDs are not exposed as navigational identifiers.
- Invitation acceptance verifies authenticated email and expiry.
- Event codes cannot bypass addressed invitation rules.
- Users cannot alter another user's profile, pitches, feedback, goals, or notification preferences.
- Organizers cannot access unrelated organizations or events.
- Reviewers can access only the scope granted to them.
- Public pitch visibility is explicit, not assumed from having a URL.

### RLS test actors

Every security-sensitive feature should be tested as:

1. Anonymous user.
2. Unrelated authenticated user.
3. Resource owner.
4. Event founder participant.
5. Event coach/mentor/judge.
6. Event admin/organizer.
7. Trusted reviewer in scope.
8. Trusted reviewer out of scope.
9. Platform admin.

### Privacy expectations

- Invite-only pitches are not indexable or publicly enumerable.
- Founder email addresses are not exposed to unrelated users.
- Recording permissions are requested only when the user starts a recording flow.
- Analytics should avoid storing video or note contents unnecessarily.

## 12. UX and Design Framework

### Visual hierarchy

1. Pitch video.
2. Current founder/startup and feedback ask.
3. Contextual actions.
4. Progress and gamification.
5. Secondary navigation.

### Design behavior

- Use restrained dark surfaces with cyan/lime as accents, not dominant fills everywhere.
- Liquid-glass effects may support overlays, but never reduce readability or performance.
- Avoid nested cards and giant modal forms.
- Drawers and modals must fit the viewport and own their scrolling.
- Use familiar icons with tooltips; do not use a plus sign where a fire, glass, microphone, or other explicit icon communicates the action.
- Use rounded controls consistently without making every section a decorative pill.
- Empty states explain the next action.
- Loading states have timeout and retry behavior.

### Mobile acceptance criteria

Every interactive screen must be verified at minimum at:

- 320 x 568.
- 375 x 667.
- 390 x 844.
- 430 x 932.
- A common desktop viewport such as 1440 x 900.

Checks:

- No clipped CTA.
- No inaccessible content below a fixed footer.
- No body scroll lock after closing an overlay.
- On-screen keyboard does not hide the active input or submit action.
- Touch targets are at least approximately 44 x 44 CSS pixels.
- Safe-area insets are honored.
- Landscape remains usable even when portrait is recommended.

## 13. Non-Functional Requirements

### Reliability

- Feedback submission is idempotent.
- Uploads expose retryable failures.
- Invitation acceptance can be retried safely.
- Scheduled sends record success, skip, and failure states.
- Empty datasets resolve to empty states, not perpetual spinners.

### Performance

- Prioritize the current video and preload only what improves next-swipe latency.
- Avoid loading organizer, achievement, or admin data on the founder feed unless visible.
- Keep client bundles small around recording and playback.
- Use image sizing and video poster strategies to avoid layout shifts.
- Measure time to first playable video and feedback drawer interaction latency.

### Accessibility

- Keyboard access for desktop controls.
- Visible focus states.
- Accessible names for icon buttons.
- Sufficient contrast.
- Captions/transcripts are a future accessibility priority, distinct from feedback-note speech-to-text.
- Motion respects reduced-motion preferences.

### Observability

Track at least:

- Auth and invite failures by reason.
- Upload initiated/completed/failed.
- Processing time to playable.
- Pitch published.
- Feedback drawer opened/submitted/failed.
- Useful feedback rating.
- Event invite sent/opened/accepted.
- Nudge attempted/sent/skipped/failed.

Do not log secrets, OTPs, full private notes, or raw media.

## 14. Metrics Framework

### Activation

- Invited users who authenticate.
- Authenticated founders who complete profile/startup setup.
- Founders who publish first pitch within 24 hours.

### Core loop

- Pitches per active founder.
- Percentage of founders posting a second version.
- Median time from pitch to first feedback.
- Useful feedback coverage.
- Reviews given per pitch posted.
- Percentage of founders selecting a Best Take.

### Retention

- Day 2, day 7, and week 4 founder return.
- Founders returning without a manual personal nudge.
- Event founders practicing before the final deadline.

### Quality

- Feedback marked useful.
- Generic/not-helpful feedback rate.
- Repeated signals that lead to a better take.
- Founder-reported clarity/confidence improvement.

### Organizer value

- Invite acceptance.
- Founder participation.
- Feedback coverage by deadline.
- Final-take completion.
- Organizer time saved and willingness to run another program.

## 15. Roadmap

### Phase A: Pilot stabilization

- Prove invitation, authentication, recording, upload, playback, feedback, and Best Take end to end.
- Complete RLS actor-matrix audit.
- Verify all transactional email on staging and production domains.
- Test mobile recording/upload on real iOS and Android devices.
- Remove confusing legacy pilot/preview language from user-facing flows.

### Phase B: Feedback density

- Refine assigned review queue.
- Enforce or encourage review reciprocity without blocking first activation.
- Calibrate usefulness ratings and reputation.
- Run weekly Pitch Hour.
- Add operations dashboard for uncovered pitches.

### Phase C: Organizer value proof

- Run one real event end to end.
- Improve invitation and team-management operations.
- Add action-focused organizer alerts.
- Refine outcome reporting.
- Capture organizer testimonials and willingness to pay.

### Phase D: Paid sprint

- Run a four-week paid cohort manually.
- Use external payment links before building billing.
- Measure repeat participation and referrals.

### Phase E: Scale carefully

- Multiple startups and plan limits.
- Push notifications after consent and retention proof.
- Deeper automated pitch coaching only when supported by reliable data.
- Public access in batches with moderation and review supply controls.

## 16. Launch Gates

Do not call the product pilot-ready until all critical paths pass in the target environment.

### Founder gate

- Invite new founder.
- Authenticate with invited email.
- Complete profile/startup.
- Record or upload on mobile.
- Publish and play.
- Give and receive feedback.
- View saved feedback.
- Publish a second version.
- Mark Best Take.
- See momentum update.

### Organizer gate

- Invite organizer.
- Authenticate and accept.
- Create/edit event.
- Invite team and founders.
- Founder accepts without remembering a code.
- Founder records an eligible take.
- Team views submissions and progress.
- Organizer sends announcement.
- Event outcome report loads.

### Reviewer gate

- Invite trusted reviewer.
- Authenticate and accept.
- See only allowed review scope.
- Submit feedback.
- Founder rates usefulness.
- Reviewer reputation/assignment updates.

### Security gate

- RLS actor matrix passes.
- Admin and service routes reject unauthorized access.
- No client bundle contains secrets.
- Public URLs do not expose raw internal identifiers.
- Invite expiry and email binding work.

### Operations gate

- Resend sender domains verified.
- Cloudflare Stream credentials and playback verified.
- Cron secret and hourly schedule configured.
- Staging and production databases have matching approved migrations.
- Rollback and incident owner are identified.

## 17. Product Do and Don't List

### Do

- Optimize for one clear next action.
- Ask for structured feedback before prose.
- Make review supply visible and operationally manageable.
- Keep video central and controls subtle.
- Preserve founder history across roles and events.
- Make invitations contextual, addressed, expiring, and easy to accept.
- Keep one startup in the MVP UI while designing the schema for more.
- Use manual operations where automation has not been validated.
- Label experimental features and measure them.

### Don't

- Call PiP a startup-idea discovery app.
- Open the product before useful feedback density is reliable.
- Make users remember event codes as the primary path.
- Treat route secrecy as authorization.
- Expose database IDs in URLs.
- Ask founders to re-enter startup data for every take.
- Require an essay to submit feedback.
- Let gamification overpower the pitch.
- Ship push, SMS, payments, or complex ranking before the core loop is stable.
- Claim a capability is shipped because it exists in an old document or branch.

## 18. Decisions and Known Tensions

### Invite-only versus "in public"

Invite-only is a temporary founding-cohort operating model, not the permanent brand promise. The marketing site remains public while app access is released in batches.

### Named versus anonymous feedback

Named peer feedback can become overly polite. Test accountable anonymity carefully: the platform retains reviewer identity for moderation while the pitch owner may see role or pseudonymous presentation. Do not enable unaccountable anonymous abuse.

### Feed versus practice room

The feed improves consumption and interaction speed, but the product should feel like a safe practice room. Discovery is secondary to improvement.

### Streaks versus sustainable progress

Daily momentum can form a habit, but punitive streak loss can create shame. Show active days, reps, improvement, and Best Take alongside streaks.

### Automation versus learning

Manual cohort operations are acceptable until the ritual is proven. Automate recurring pain, not imagined scale.

## 19. Open Risks

- Mobile browser recording and upload reliability varies by device and browser.
- Review supply may lag pitch demand.
- Friendly pilot participants may inflate retention and usefulness metrics.
- Event role permissions and RLS remain high-risk as complexity grows.
- Video processing cost and latency must be observed under real use.
- Email delivery depends on exact sender-domain and environment configuration.
- Existing documentation and environment examples contain legacy allowlist/phone assumptions that should be removed in a separate cleanup.

## 20. Documentation Governance

When product behavior changes:

1. Update this handbook in the same pull request.
2. Update the capability status matrix.
3. Add or update the relevant migration/runbook.
4. Record unresolved decisions as explicit risks or proposals.
5. Never overwrite a shipped fact with an aspiration.

Use these labels in future specifications:

- `Current`: verified in the current release branch and schema.
- `Verify`: implemented but not proven in the target environment.
- `Planned`: approved but not implemented.
- `Proposed`: under discussion.
- `Deferred`: explicitly out of scope.
