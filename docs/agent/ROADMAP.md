# Pitch in Public Roadmap

Last updated: 2026-07-17

This roadmap exists to keep future builds focused on the product wedge:

```text
Founders practice pitches, receive useful feedback, improve, and repeat.
```

## Phase 0 - Foundation

Status: mostly built.

Scope:

- Worktree setup.
- Landing page.
- Waitlist/lead capture.
- Supabase auth.
- Google sign-in.
- Email OTP.
- Cloudflare Stream upload/playback.
- Founder feed.
- Recording/upload/publish.
- Basic Toast/Roast.
- Platform admin seed.

Key risks:

- Video upload edge cases.
- Feedback display consistency.
- Mobile browser polish.

## Phase 1 - Founder Practice Loop

Status: partially built, still needs refinement.

Goal:

Make the founder loop obvious and satisfying:

```text
Record -> get feedback -> improve -> mark best take -> repeat
```

Must-have:

- Startup profile setup with one startup per founder.
- Upload form prepopulates startup info.
- Feedback ask chips.
- Multi-select feedback chips.
- Readiness state.
- Feedback visible per pitch.
- Best Take.
- Own pitches profile/grid.
- Daily prompt.
- Pitch progression/versioning.
- Momentum widget with 7-day heatmap.
- Clean mobile recording/upload.

Done when:

- A founder can complete two pitch versions and clearly see improvement/feedback.
- No repeated startup fields unless missing.
- Feedback is visibly saved and displayed.
- Best Take is clear.

## Phase 2 - Organizer Pitch Rooms

Status: in progress.

Goal:

Enable invite-only organizers to run a lightweight pitch practice room for founders.

Must-have:

- Platform admin sends organizer invite.
- Organizer accepts invite.
- Organizer creates event/pitch room.
- Organizer sets pitch duration in minutes.
- Organizer invites team:
  - Admin.
  - Coach.
  - Mentor.
  - Judge.
- Organizer invites founders.
- Founder joins.
- Founder submits/marks Best Take.
- Team sees submissions.
- Basic announcements.

Done when:

- A real organizer can invite 3 founders and 2 team members.
- Founders can submit pitch videos.
- Organizer team can see who submitted and what feedback exists.

## Phase 3 - Private Pilot

Status: upcoming.

Goal:

Run 10-20 selected founders through a 2-week private pilot.

Pilot promise:

```text
Record your first 60-second pitch, get structured Roast/Toast feedback, improve it, and leave with a stronger Best Take.
```

Founder requirements:

- Submit first take.
- Give feedback to others.
- Submit improved take.
- Mark best take.

Operational requirements:

- Manual onboarding okay.
- Manual reminders okay.
- Manual featured picks okay.
- Manual feedback calls okay.

Success metrics:

- 10+ founders join.
- 8+ submit first pitch.
- 5+ submit second version.
- 3+ feedback responses per pitch.
- 3+ useful feedback responses per active pitch.
- Median time to first useful review under 24 hours during pilot.
- 3+ founders would invite another founder.
- 3+ founders would pay for a 4-week sprint.

## Phase 3A - Review Marketplace

Status: shipped to staging and release-verified on 2026-07-18.

Detailed specs:

- [REVIEW_MARKETPLACE_SPEC.md](REVIEW_MARKETPLACE_SPEC.md)
- [REVIEW_MARKETPLACE_IMPLEMENTATION_PLAN.md](REVIEW_MARKETPLACE_IMPLEMENTATION_PLAN.md)

Goal:

Turn feedback from an optional social action into a reliable supply system.

Must-have:

- Assigned review queue.
- Event-scoped review coverage.
- Feedback usefulness ratings.
- Soft review credits.
- Reviewer role labels.
- Pitch-hour readiness metrics.

Done when:

- Active founders know exactly which pitches to review.
- Submitted feedback updates assignment state.
- Pitch owners can rate feedback quality.
- Organizers can see which founders need more feedback.
- The pilot can measure useful reviews per active pitch.

Shipped scope:

- Assigned review queue with self-review exclusion and event scoping.
- Assignment completion when structured feedback is submitted.
- Private usefulness ratings and useful-feedback aggregates.
- Soft review credits that encourage reciprocity without blocking pilot posts.
- Reviewer role labels for peers, coaches, mentors, judges, organizers, and public reviewers.
- Organizer feedback coverage, assignment, and pitch-hour readiness controls.
- Invite-only founder access and fail-closed event membership.

Release verification:

- Founder quick Toast/Roast and detailed feedback passed in desktop and mobile browser viewports.
- Event organizer dashboard, founder/team invites, announcements, and submission data passed in staging.
- Cloudflare upload and processing passed with a 31-second 9:16 mobile test video; the temporary asset was deleted.
- Staging and production schemas contain the complete migration history and pass Supabase schema lint.
- Anonymous and unrelated authenticated users cannot read private event membership, invitations, assignments, credits, or votes.

## Phase 4 - Paid Pitch Without Fear Sprint

Status: not started.

Goal:

Charge $49 per founder for a 4-week sprint.

Structure:

- 20 founders max.
- Weekly pitch improvement prompts.
- Public/private feedback room.
- Final Best Take.
- Optional live Zoom pitch room.

Revenue target:

```text
20 founders x $49 = $980
```

Do not build:

- Complex payments inside product at first.
- Automated cohort admission.
- Full program management.

Use:

- Stripe payment link if needed.
- Manual acceptances.
- Manual email reminders if needed.

## Phase 5 - Scale Distribution

Status: later.

Goal:

Use organizer/event distribution to acquire founders in batches.

Targets:

- Pitch competitions.
- Startup bootcamps.
- Demo days.
- University entrepreneurship programs.
- Local founder groups.
- Accelerators.
- Speed networking events.

Product improvements:

- Event templates.
- Public event landing pages.
- Judge scorecards.
- Coach assignment.
- Founder progress reports.
- Export/share best takes.
- Organizer analytics.

## Phase 6 - Mobile/PWA and Notifications

Status: later.

Goal:

Make the product a daily habit.

Potential work:

- PWA install polish.
- Push notifications.
- Email nudges.
- SMS nudges after proof.
- Desktop-to-phone QR record handoff.
- Native app only if web proves retention.

Current shipped slice:

- Email nudges now exist for daily founder prompts and event deadline reminders.
- Founder preference management is exposed through an in-app route.
- Push notifications and SMS remain deferred until retention proves out.

Nudge example:

```text
Your pitch sprint task today: make the customer obvious in sentence one. Record a 60-sec take.
```

## Explicitly Deferred

- Investor discovery.
- Startup idea discovery.
- Broad public social network.
- DMs.
- Advanced ranking algorithms.
- Paid multi-startup support.
- Native mobile.
- SMS login.
- Fully automated cohorts.
- Complex CRM-like organizer platform.

## Next Highest-Leverage Work

1. Run the controlled pilot and monitor useful reviews per active pitch, median time to first useful review, and second-take completion.
2. Seed the first 50 reviews with organizers and trusted founders so the quality norm is explicit.
3. Validate the real iOS Safari and Android Chrome camera flow with pilot devices.
4. Add hard review-credit gating only if the soft reciprocity prompt does not sustain review supply.
5. Add push notifications only after email nudge engagement and repeat practice are measured.
