# Review Marketplace Implementation Plan

Last updated: 2026-07-17

This plan breaks the feedback marketplace into independent workstreams that can run in parallel branches and worktrees.

Base branch:

```text
test-env
```

Promotion path:

```text
feature branch -> test-env -> staging -> main -> production
```

## Merge Order

Recommended order:

1. `review-queue`
2. `feedback-reputation`
3. `review-credits`
4. `reviewer-roles`
5. `pitch-hour-metrics`

This order keeps the system useful before it becomes restrictive.

## Shared Constraints

All workstreams must preserve:

- Mobile-first founder UX.
- Video as the center of attention.
- Invite-only app access during pilot.
- No raw DB UUIDs in user-facing URLs.
- RLS protection for event, pitch, feedback, and assignment data.
- Existing organizer/founder flows.
- Existing Supabase migration workflow.
- Existing design direction: polished dark UI, restrained liquid glass, less cognitive load.

All workstreams must update:

- Relevant docs in `docs/agent`.
- Tests or smoke checks where practical.
- Browser verification notes for changed UX.

## Workstream 1: Review Queue

Branch:

```text
review-queue
```

Worktree:

```text
/Users/arunthachi/project/worktrees/pitchinpublic/review-queue
```

Goal:

Assign pitches to reviewers so feedback becomes an obligation, not an optional open feed behavior.

Scope:

- Add `review_assignments` migration.
- Create assignment generation helper.
- Show compact "pitches waiting for your signal" card for founders.
- Update queue when feedback is submitted.
- Add organizer coverage summary for event rooms.

Acceptance criteria:

- Founder sees only their assigned reviews.
- Founder cannot receive their own pitch as an assignment.
- Submitting feedback marks assignment completed.
- Event organizer can see which pitches have low feedback coverage.
- RLS blocks cross-user assignment access.

Out of scope:

- Hard posting gates.
- Complex assignment optimization.
- Public reviewer marketplace.

## Workstream 2: Feedback Reputation

Branch:

```text
feedback-reputation
```

Worktree:

```text
/Users/arunthachi/project/worktrees/pitchinpublic/feedback-reputation
```

Goal:

Let pitch owners mark whether feedback was useful so the product can reward quality, not volume.

Scope:

- Add `feedback_quality_votes` migration.
- Add useful/generic/not helpful actions on received feedback.
- Add aggregate useful feedback count per pitch.
- Keep ratings private to pitch owner, reviewer, organizer/admin aggregate views.
- Add basic anti-double-vote constraint.

Acceptance criteria:

- Pitch owner can rate each feedback item once and change the rating.
- Non-owner cannot rate feedback on another founder's pitch.
- Useful feedback count appears in pitch feedback summary.
- Generic/not helpful feedback does not visibly shame reviewers in the public UI.

Out of scope:

- Public reviewer scorecards.
- Full reputation ranking.

## Workstream 3: Review Credits

Branch:

```text
review-credits
```

Worktree:

```text
/Users/arunthachi/project/worktrees/pitchinpublic/review-credits
```

Goal:

Create a soft reciprocity economy: founders give useful reviews to earn more review requests.

Scope:

- Add review credit ledger or aggregate table.
- Award pending credit when feedback is submitted.
- Upgrade pending to earned when feedback is marked useful or trusted by system.
- Show credit state as positive progress.
- Add copy that explains the norm without blocking pilot use.

Acceptance criteria:

- Founder sees how many reviews they have given and how many credits are available.
- Posting remains possible in pilot mode, but the app nudges toward giving feedback first.
- Organizer/admin can override credit requirement for events.

Out of scope:

- Paid credits.
- Strict hard gate until pilot behavior is validated.

## Workstream 4: Reviewer Roles

Branch:

```text
reviewer-roles
```

Worktree:

```text
/Users/arunthachi/project/worktrees/pitchinpublic/reviewer-roles
```

Goal:

Separate reviewer incentives and labels without making the founder app complex.

Scope:

- Normalize reviewer role labels:
  - Peer founder.
  - Coach.
  - Mentor.
  - Judge.
  - Organizer.
  - Experienced reviewer.
  - Public reviewer.
- Add role label to feedback display.
- Keep identity accountable in data while allowing public display to be role-based.
- Ensure organizer team feedback uses the correct role.

Acceptance criteria:

- Feedback can display a role label instead of always showing a named user.
- Admin/system data still knows who submitted feedback.
- Organizer dashboard can filter feedback by role.
- Founder feed remains simple.

Out of scope:

- Full anonymous commenting.
- Public follower/friend system.

## Workstream 5: Pitch Hour Metrics

Branch:

```text
pitch-hour-metrics
```

Worktree:

```text
/Users/arunthachi/project/worktrees/pitchinpublic/pitch-hour-metrics
```

Goal:

Give organizers a synchronous review moment and track marketplace health.

Scope:

- Add pitch hour fields/config for events.
- Add event dashboard metrics:
  - pitches submitted
  - reviews assigned
  - reviews completed
  - useful reviews
  - time to first feedback
  - founders with zero useful feedback
- Add a lightweight pitch-hour panel for organizer team.

Acceptance criteria:

- Organizer can schedule or label a pitch-hour window.
- Dashboard surfaces coverage gaps clearly.
- Metrics are event-scoped and RLS-protected.
- No unrelated founder feed clutter.

Out of scope:

- Live video rooms.
- Chat.
- Calendar integration.

## Worker Instructions

Each worker task should:

1. Work only inside its assigned worktree.
2. Read:
   - `docs/agent/README.md`
   - `docs/agent/CONTEXT.md`
   - `docs/agent/MEMORY.md`
   - `docs/agent/PRODUCT_SPEC.md`
   - `docs/agent/REVIEW_MARKETPLACE_SPEC.md`
   - `docs/agent/REVIEW_MARKETPLACE_IMPLEMENTATION_PLAN.md`
   - `docs/agent/WORKFLOWS.md`
3. Inspect current code before editing.
4. Keep the first iteration small enough to review.
5. Commit to its branch.
6. Do not merge back to `test-env`.
7. Report:
   - files changed
   - migrations added
   - checks run
   - risks
   - suggested next iteration

