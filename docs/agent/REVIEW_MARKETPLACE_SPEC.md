# Pitch in Public Review Marketplace Spec

Last updated: 2026-07-17

## Strategic Decision

Pitch in Public does not win because founders can upload short videos. It wins if a founder records a vulnerable 60-second pitch and reliably receives useful, constructive feedback quickly enough to record a better take.

That makes feedback the product's liquidity event.

The marketplace model:

```text
Pitchers = demand
Reviewers = supply
Useful feedback = liquidity
Better next take = retained behavior
```

The app should optimize for review density and feedback quality before optimizing for broad discovery, public virality, or creator-style engagement.

## Why This Matters

An open feed of pitches creates diffusion of responsibility. Everyone can review, so nobody feels responsible. A founder who posts and gets silence, generic praise, or snark will not post again.

For the controlled pilot, the product must create a safe pitch practice room:

- Founders know their pitch will be seen.
- Reviewers know exactly what to review.
- Feedback is fast to give.
- Feedback quality is measured.
- Organizers can see coverage gaps and intervene.

## Product Principles

1. **Assign, don't invite.** A queue that says "3 pitches waiting for your signal" is stronger than an open feed.
2. **Make feedback reciprocal.** Founders earn feedback by giving useful feedback to others.
3. **Cut review friction.** Median review time should be about 45 seconds.
4. **Protect feedback quality.** Pitchers should rate whether feedback was useful.
5. **Separate reviewer types.** Peer founders, experienced reviewers, organizers, and public reviewers need different incentives and UX.
6. **Keep video primary.** Review mechanics must not visually overpower the pitch video.
7. **Seed culture manually.** Early reviews from the founder/operator and organizers set the permanent norm.

## Reviewer Types

### Peer Founders

Peer founders are the volume layer.

Motivation:

- Reciprocity.
- Calibration.
- Learning by judging other pitches.
- "Investor mode" practice: seeing what makes a pitch clear or weak.

UX framing:

```text
Reviewing helps you sharpen your own pitch.
```

### Experienced Reviewers

Experienced reviewers include angels, ex-founders, accelerator staff, coaches, and operators.

Motivation:

- Deal flow.
- Status.
- Helping high-potential founders.
- Visibility inside a curated room.

They should not be forced into the same reciprocal credit economy as peer founders because they may not have pitches to post.

### Event Organizer Team

Organizer team members include admins, coaches, mentors, and judges.

Motivation:

- Improve founder readiness before pitch day.
- Ensure every founder receives coverage.
- See progress and final takes.

Organizer dashboards should show review coverage and gaps, not just submitted videos.

### Public Reviewers

Public reviewers are non-founder listeners who can answer whether the pitch made sense.

Motivation:

- Low-friction participation.
- Being part of a room/event.
- Giving honest layperson clarity signal.

This is later-stage. For pilot, public reviewing should be limited or event-scoped.

## Feedback Unit

Every useful review should be structured:

1. Toast or Roast.
2. One or more signal chips.
3. Readiness:
   - Needs work.
   - Getting there.
   - Pitch-ready.
4. Optional timestamp signal:
   - Lost interest here.
   - Customer became clear here.
   - Ask appeared here.
5. Optional short note.

No long note should be required when the structured signal is complete.

## Review Queue

The review queue is the highest-leverage feature for feedback density.

Founder-facing copy:

```text
3 pitches are waiting for your signal today.
```

Assignment priority:

1. Same event or pitch room.
2. Pitches with low feedback coverage.
3. Pitches matching the reviewer's role or focus.
4. Recent active founders.
5. Avoid self-review.
6. Avoid assigning the same reviewer to the same founder repeatedly when possible.

Assignment states:

- Pending.
- Started.
- Submitted.
- Skipped.
- Expired.

The queue should feel like a daily task, not a generic inbox.

## Review Credits

Review credits solve the asymmetry that everyone wants feedback but fewer people want to give it.

Initial rule:

```text
Give 2 useful reviews to earn enough credit to request feedback on 1 pitch.
```

Pilot behavior:

- Start as a soft gate.
- Show the credit state clearly.
- Let organizers/admins override it during live pilots.
- Enforce only after the ritual is understood.

Credit quality states:

- Pending: review submitted but not yet rated.
- Earned: pitcher marked it useful or system trusts the reviewer.
- Discounted: review was marked generic or not helpful.

Do not reward generic comments like "great energy" as strongly as specific feedback.

## Feedback Quality

Pitch owners should be able to rate received feedback:

- Useful.
- Generic.
- Not helpful.

This rating is private to the system and optional for the founder.

Quality metrics:

- Useful feedback rate.
- Generic feedback rate.
- Reports.
- Average time to first useful review.
- Useful reviews per pitch.

Important: note length is not the same as quality. A short specific signal can be excellent.

## Identity and Anonymity

Named peer feedback can become too polite. Founders avoid direct criticism if they may need the person later.

Pilot direction:

```text
Anonymous-to-the-crowd, accountable-to-the-system.
```

This means:

- Pitch owner can see a role label such as "Peer founder", "Coach", or "Judge".
- Public feed does not need to expose every reviewer identity.
- Admin/system audit always knows who gave the feedback.
- Abuse reports and low-quality patterns remain enforceable.

Do not build full anonymity that removes accountability.

## Pitch Hour

Async communities often die quietly. A weekly synchronous review window creates density.

Pitch Hour:

- Organizer or platform admin schedules a 30-60 minute window.
- Founders join knowing feedback will happen live or near-live.
- Review queue is event-scoped during the window.
- Organizer sees coverage in real time.

This is especially important for pitch competitions, cohorts, and founder rooms.

## Metrics

Track these from day one:

- Pitches submitted.
- Reviews requested.
- Reviews assigned.
- Reviews completed.
- Reviews marked useful.
- Reviews per pitch.
- Useful reviews per pitch.
- Time to first review.
- Time to first useful review.
- Time to three useful reviews.
- Reviewer participation rate.
- Reviewer completion rate.
- Review credit balances.
- Event-level feedback coverage.

Leading indicator:

```text
Useful reviews per active pitch
```

If this declines, the marketplace is weakening even if signups rise.

## Data Model Direction

Recommended additions:

- `review_assignments`
  - pitch id
  - reviewer user id
  - event id nullable
  - status
  - due at
  - completed feedback id nullable
  - assignment reason
- `review_credits`
  - user id
  - balance
  - pending balance
  - earned count
  - spent count
- `feedback_quality_votes`
  - feedback id
  - pitch owner user id
  - rating
  - created at
- `reviewer_reputation`
  - computed view or materialized aggregate
  - useful count
  - generic count
  - not helpful count
  - completion rate
- `pitch_events`
  - review exchange policy
  - pitch hour settings

RLS requirements:

- Reviewers can see only assignments for themselves.
- Pitch owners can rate feedback on their own pitches.
- Organizers can see assignments and coverage for events they administer.
- Platform admins can audit all records.
- No raw DB identifiers should be exposed in public URLs.

## UX Surfaces

### Founder App

- Compact review queue card.
- "Review 3 pitches" daily task.
- Credit state shown as progress, not punishment.
- Video stays primary.
- Feedback actions remain subtle.

### Feedback Drawer

- Fits inside phone frame.
- Scrollable when content exceeds viewport.
- Timestamp chip appears while watching.
- Multi-select chips.
- Optional note.
- Submit button visible and responsive.

### Pitch Owner View

- Feedback list per pitch.
- Repeated signal summary.
- Useful/generic/not helpful rating.
- Next improvement prompt.

### Organizer Dashboard

- Coverage by founder.
- Pitches with zero useful feedback.
- Review assignment progress.
- Pitch Hour queue.
- Team member contribution.

## Phases

### RM-0: Docs and Alignment

Status: this document.

Goal:

- Commit strategy and implementation plan before building.

### RM-1: Assigned Review Queue

Goal:

- Every active founder sees a small assigned queue.
- Organizers can see coverage gaps.

### RM-2: Review Credits

Goal:

- Founders understand that giving feedback earns feedback.
- Start with soft gates.

### RM-3: Feedback Quality and Reputation

Goal:

- Pitchers can mark feedback useful/generic/not helpful.
- Generic feedback is not rewarded like useful feedback.

### RM-4: Reviewer Roles and Accountable Anonymity

Goal:

- Support peer founder, coach, mentor, judge, organizer, experienced reviewer, and public reviewer labels.
- Keep reviewers accountable in admin/system data.

### RM-5: Pitch Hour and Metrics

Goal:

- Organizer can create a synchronous review window.
- Admin/organizer can see marketplace health.

## Non-Goals

Do not build these before the review loop is proven:

- Open public reviewer marketplace.
- Paid expert review marketplace.
- Investor discovery feed.
- Complex public reputation leaderboard.
- Automatic AI pitch scoring as the primary feedback source.
- Full anonymous social commenting.
- DM system.

## Launch Policy

For the pilot:

- Marketing site stays open.
- App remains invite-only.
- Founding cohort framing explains the gate.
- Organizer invites create dense rooms.
- Platform/operator manually seeds feedback.
- Measure whether founders return without personal nudging.

