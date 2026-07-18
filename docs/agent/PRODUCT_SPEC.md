# Pitch in Public Product Spec

Last updated: 2026-07-17

## One-Line Product Definition

Pitch in Public is a mobile-first pitch practice room where founders record short pitch takes, get structured Roast/Toast feedback, improve through versions, and submit or share their best take.

## Product Principles

1. Video is the center of gravity.
2. The next action should be obvious.
3. Feedback must be lightweight but useful.
4. Improvement matters more than likes.
5. Events/cohorts are the distribution wedge, not a separate product.
6. Manual pilot operations are acceptable until the behavior is proven.
7. Mobile-first web should feel like an app, not a responsive desktop page.

## North Star Loop

```text
Record a take -> receive useful feedback -> identify the next improvement -> record a better take -> mark best take
```

Supporting loops:

- Give feedback to unlock more useful feedback.
- Complete assigned review queue to earn review credits.
- Rate received feedback so useful reviewers rise and generic feedback is filtered.
- Join an event/cohort and submit best take.
- See daily momentum and return tomorrow.
- Organizer sees founder progress and nudges the room.

## MVP Scope

### Founder MVP

Must support:

- Sign in with Google and email OTP.
- Create/update profile.
- One startup per founder.
- Startup profile fields:
  - Startup name.
  - One-line pitch.
  - Website/LinkedIn.
  - Feedback focus.
- Record/upload portrait pitch video.
- Publish pitch.
- View feed.
- View own pitches in profile-style grid/list.
- Give Roast/Toast feedback.
- Select multiple feedback chips.
- Add optional feedback note.
- Add readiness rating:
  - Needs work.
  - Getting there.
  - Pitch-ready.
- Display feedback per pitch.
- Mark one pitch as Best Take.
- See practice momentum:
  - Reps.
  - Days.
  - Run/streak.
  - 7-day activity heatmap.
  - Best take status.

Should support:

- Daily prompt.
- Pitch path/progression.
- Confetti or celebration for publish and feedback moments.
- Share link.
- Mobile upload.

Can defer:

- Phone/SMS auth.
- Native app.
- Full social graph.
- DMs.
- Advanced recommendation feed.
- Multiple startup profiles.

### Organizer MVP

Must support:

- Invite-only organizer access.
- Organizer invite accepted by email-matching signed-in user.
- Organizer profile/role.
- Create event/pitch room.
- Configure:
  - Event name.
  - Pitch date.
  - Submission deadline.
  - Pitch duration in minutes.
  - Sprint focus.
  - Event context.
- Invite team:
  - Admin.
  - Coach.
  - Mentor.
  - Judge.
- Invite founders.
- Founder joins event.
- Founder submits or marks best take.
- Organizer team sees submissions and feedback summary.

Should support:

- Organizer announcement to founders.
- Copy invite links.
- Event dashboard with submission status.
- Basic founder progress table.

Can defer:

- Automated payment.
- Full email campaign builder.
- Judge scoring matrix.
- Public event landing pages for every organizer.
- Complex permissions beyond MVP team roles.

### Platform Admin MVP

Route:

```text
/pip-super-admin
```

Must support:

- Super admin auth gate.
- Organizer invite creation.
- Organizer invite resend.
- Delivery status display:
  - Email sent.
  - Email failed.
  - Email not configured.
  - Email skipped.
  - Unknown.
- Overview of:
  - Founders.
  - Organizers.
  - Events.
  - Lead/access requests.
  - Organizer invite history.

Super admin seed:

```text
arun@pitchinpublic.io
```

## Founder Experience

### First-Time Founder Flow

1. Founder lands on marketing page.
2. Founder signs in.
3. Founder completes minimum profile:
   - Name.
   - Startup name.
   - One-line pitch.
   - Feedback focus.
4. App opens to a clear next action:
   - "Record today's pitch."
5. Founder records/uploads a portrait video.
6. App previews video and asks only for missing or per-take details.
7. Founder publishes.
8. Founder receives visible prompt:
   - "Ask 3 builders for feedback."
9. Feedback appears on the pitch.
10. Founder records next version.
11. Founder marks Best Take.

### Returning Founder Flow

1. App shows today's pitch prompt.
2. Sidebar/compact header shows momentum.
3. Founder taps Record.
4. Existing startup info is prefilled.
5. Founder publishes a new version.
6. Founder compares current take to Best Take.

### Upload Detail Rules

Do not force startup profile fields every time.

Show startup fields only when:

- Missing required startup info.
- Founder chooses to edit startup info.
- Founder switches to a future paid-plan multi-startup workflow.

Show per-take fields:

- Feedback ask chips.
- Optional "what changed since last take?"
- Optional event context if submitting to a pitch room.

## Feedback Experience

### Feedback Capture

The feedback form should be fast:

1. Choose Toast or Roast.
2. Select one or more signal chips.
3. Choose readiness.
4. Optional timestamp signal.
5. Optional note.
6. Submit.

No required long text note for basic signal feedback.

### Toast Signal Examples

- Clear.
- Compelling.
- Strong problem.
- Strong customer.
- Strong ask.
- Confident.
- Memorable.
- Pitch-ready.

### Roast Signal Examples

- Too vague.
- Customer unclear.
- Problem weak.
- Too long.
- Weak ask.
- Needs proof.
- Jargon.
- No urgency.

### Readiness Ratings

Use simple states:

- Needs work.
- Getting there.
- Pitch-ready.

Do not use long 1-10 scales as the primary feedback input.

### Feedback Display

Per pitch, show:

- Toast count.
- Roast count.
- Comment/signal count.
- Repeated chips.
- Readiness distribution.
- Notes.
- Suggested next improvement.

The founder should never wonder where feedback went after submission.

## Review Marketplace

Detailed spec:

```text
docs/agent/REVIEW_MARKETPLACE_SPEC.md
```

The feedback system is a two-sided marketplace:

```text
Pitchers = demand
Reviewers = supply
Useful feedback = liquidity
```

Core direction:

- Assign reviews instead of relying on open feed browsing.
- Show founders a small daily queue of pitches waiting for their signal.
- Use review credits as a soft reciprocity economy during pilot.
- Let pitch owners rate feedback as useful, generic, or not helpful.
- Preserve reviewer accountability in system/admin data.
- Allow public display to use role labels when appropriate.
- Give organizers coverage dashboards so every founder gets useful feedback.

Review roles:

- Peer founder.
- Coach.
- Mentor.
- Judge.
- Organizer.
- Experienced reviewer.
- Public reviewer.

Do not build broad public reviewing or paid expert review marketplaces until assigned review density works for private pilots and organizer rooms.

## Practice Habit System

### Today's Pitch Prompt

Every day, show one concrete task.

Examples:

- "Name the customer in sentence one."
- "Make the painful problem obvious."
- "End with one specific ask."
- "Remove filler before the first noun."
- "Say why now."

### Pitch Path

Recommended path:

1. Customer - name who it is for.
2. Pain - make the problem obvious.
3. Pull - show why people care.
4. Why now - create urgency.
5. Ask - end with one action.
6. Confidence - sound clear on camera.
7. Best take - pick the one to share.

### Daily Quests

Daily quests should be simple and contextual:

- Record today's rep.
- Get one useful signal.
- Choose a best take.

### Achievements

Achievement examples:

- First Rep - record one pitch.
- Three Takes - practice three versions.
- Signal Builder - earn a feedback signal.
- Momentum - reach a 7-day run.

Keep achievements subtle. They support habit but should not overtake the video.

### Momentum Widget

Founder should see:

- Current run.
- Total pitch reps.
- Last 7 days heatmap.
- Best take age/status.
- Goal button.

The heatmap is valued and should remain available in compact form.

## Video Experience

### Format

Default founder pitch:

- Portrait/tall video, similar Reels/TikTok.
- Default 60 seconds.

Event-specific:

- Organizer can set pitch length in minutes.
- UI should show pitch length in minutes to end users.

### Recording

Recording should:

- Show timer.
- Make minimum duration understandable.
- Show `Preview`/`Stop` clearly after minimum duration.
- Not force confusing rules.
- Fit modal content on laptop and mobile browsers.

### Upload

Upload should:

- Support mobile browser uploads.
- Validate portrait orientation.
- Provide friendly error copy.
- Avoid trapping users on the same upload page without explanation.

### Playback

Playback should:

- Favor HLS where available.
- Handle processing states gracefully.
- Avoid fatal console noise where fallback is possible.
- Keep the video frame centered and proportional across desktop and mobile.

## Organizer Experience

### Organizer Invite Flow

1. Platform admin creates organizer invite.
2. Invite email sends through Resend or admin copies link.
3. Organizer signs in with the invited email.
4. Organizer accepts invite.
5. App grants organizer role.
6. Organizer can create pitch rooms.

### Event/Pitch Room Setup

Fields:

- Name.
- Pitch date.
- Submission deadline.
- Pitch length in minutes.
- Context:
  - Pitch competition.
  - Demo day.
  - Accelerator.
  - Founder cohort.
  - Networking event.
- Focus chips:
  - Clarity.
  - Customer.
  - Problem.
  - Confidence.
  - Ask.
  - Story.
  - Differentiation.
  - Why now.

Date fields should open the calendar when clicking anywhere in the field, not just the icon.

### Organizer Team

Roles:

- Organizer.
- Admin.
- Coach.
- Mentor.
- Judge.

Organizer and Admin can manage invites.

Team members can review submissions depending on role.

### Founder Event Flow

1. Founder receives invite link.
2. Founder signs in or signs up.
3. Founder accepts event.
4. Founder sees event goal and pitch length.
5. Founder records practice versions.
6. Founder submits or marks Best Take.
7. Organizer team reviews progress and final take.

## Marketing Pages

Top navigation should be clear:

- For Founders.
- For Organizers.

Avoid:

- "Private Pilot" in top nav.
- "Waitlist" as persistent top button when early access form exists.
- Confusing "For Events" label if organizer audience is broader than events.

Recommended organizer language:

```text
For Organizers
```

This includes events, cohorts, demo days, competitions, and founder programs.

Marketing contact email:

```text
hello@pitchinpublic.io
```

Lead capture should be a modern in-app popup, not Google Forms, because prospects said Google Forms reduces trust.

## Success Metrics

### Free Private Pilot

Target:

- 10-20 founders invited.

Success:

- 10+ founders join.
- 8+ submit first pitch.
- 5+ submit second version.
- Each pitch gets 3+ feedback responses.
- 3+ founders say they would invite another founder.
- 3+ founders say they would pay for a 4-week sprint.

### Paid Sprint

Target:

- 20 founders.
- $49 per founder.

Revenue:

```text
20 x $49 = $980
```

Success:

- People pay.
- People post.
- People give feedback.
- People return weekly.
- People invite others.

## Product Risks

1. Founders may not want to publicly post weak pitches.
   - Mitigation: private pilot, safe room language, controlled visibility.
2. Feedback may be too low-quality.
   - Mitigation: structured chips, readiness, required useful signal, example prompts.
3. Video upload/processing may be unreliable.
   - Mitigation: keep provider simple, verify mobile browser, clear processing state.
4. UI may become too busy.
   - Mitigation: video-first, collapse details, keep gamification secondary.
5. Organizer workflow may become too complex too early.
   - Mitigation: invite-only organizers, simple event dashboard, manual ops.
