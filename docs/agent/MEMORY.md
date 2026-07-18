# Pitch in Public Project Memory

Last updated: 2026-07-17

This file captures decisions already made in conversation so future agents do not reopen settled issues without a good reason.

## Product Positioning Decisions

### Do Not Position as "TikTok for Startup Ideas"

Rejected:

```text
TikTok-style discovery for startup ideas.
```

Why:

- It implies people are browsing or stealing startup ideas.
- It makes the product sound like entertainment or discovery.
- It weakens the real pain: founders are bad at practicing and improving their pitch.

Preferred:

```text
Daily pitch practice for founders.
```

Sharper product narrative:

```text
Pitch in Public is a public pitch gym where founders record, get roasted/toasted, improve, and build confidence.
```

### The Core Pain

The biggest indie founder pain this product addresses:

- Founders are not good at explaining what they build clearly.
- They do not practice daily.
- They freeze when asked what they do.
- They ramble instead of naming the customer, painful problem, outcome, why now, and ask.

### MVP Is Not a Generic Social Feed

The MVP should not be a broad creator/social app. It should support:

- Submit pitch.
- View pitch.
- Attach written pitch.
- Leave useful feedback.
- Mark Best Take.
- Show improvement over versions.

The TikTok-style feed can become valuable later, after enough pitch content and feedback behavior exists.

## Launch Strategy Decisions

### Preferred Launch Sequence

Current plan:

```text
Free private pilot -> learn behavior -> fix app -> paid sprint -> public launch
```

The first pilot:

- Invite-only.
- 10-20 founders.
- 2 weeks.
- Free.
- Goal is behavior validation, not revenue.

Then:

- 4-week paid sprint.
- 20 founders.
- $49 per founder.
- Manual operations are acceptable.

### Sprint Product Promise

For founders:

```text
Record your first 60-second pitch, get structured Roast/Toast feedback, improve it, and leave with a stronger Best Take.
```

For paid sprint:

```text
Record weekly 60-second pitch takes, get structured feedback, improve clarity and delivery, and leave with one public-ready Best Take.
```

### Manual Before Automation

Do not over-automate before proving the ritual.

Manual is acceptable for pilot:

- Applications.
- Acceptance.
- Weekly emails.
- Reminders.
- Choosing featured pitches.
- Onboarding.
- Feedback calls.
- Payment.

Automate after there is evidence founders:

1. Pay or commit.
2. Post.
3. Give feedback.
4. Return weekly or daily.
5. Invite others.

## Founder Workflow Decisions

### Core Pitch Submission

The core pitch submission should include:

1. Startup name.
2. One-line pitch.
3. 60-second portrait pitch video.
4. Feedback ask.

### Startup Profile vs Every Upload

Startup name and one-line pitch should primarily belong to the founder's startup profile, not be repeatedly entered on every upload.

For MVP:

- Support one startup per founder.
- Future paid plan can support multiple startups.

On upload:

- Prepopulate startup/pitch details from profile.
- Ask only for lightweight per-take info when needed.
- Extra context is optional and should explain what changed since the last take, event context, or target feedback.

### Feedback Ask

Do not rely only on free-form text. Preferred direction:

- Prebuilt chips for common feedback asks.
- Optional free-form context.

Suggested chips:

- Clarity.
- ICP/customer.
- Problem.
- Confidence.
- Ask.
- Differentiation.
- Story.
- Why now.

### Best Take

Best Take is central.

Every founder needs a reason to repeat:

```text
Can today's take beat your current best?
```

Founders should be able to mark/select the strongest pitch version.

## Feedback System Decisions

### Feedback Is the Marketplace Liquidity Event

Pitch in Public should treat useful feedback as the core marketplace transaction.

Model:

```text
Pitchers = demand
Reviewers = supply
Useful feedback = liquidity
Better next take = retained behavior
```

The product should optimize for useful feedback density before optimizing for broad discovery, public virality, or creator-style engagement.

### Assigned Review Queue Beats Open Feed

An open feed creates diffusion of responsibility. A founder seeing "40 pitches available to review" will usually review none.

Preferred:

```text
3 pitches are waiting for your signal today.
```

Assigned review queues should prioritize:

- Same event or room.
- Pitches with low feedback coverage.
- Recent active founders.
- Relevant feedback focus.
- Avoiding self-review.

### Reviewing Should Earn Reviewing

Reviewing should be framed as pitch training, not charity.

Direction:

- Founders earn the right to receive more feedback by giving useful feedback.
- Start with soft review credits during the pilot.
- Enforce only after the ritual is understood.
- Organizer/admin override remains available.

### Feedback Must Be Fast

Median review time should target about 45 seconds.

Preferred inputs:

- Toast/Roast.
- Multiple signal chips.
- Readiness.
- Optional timestamp.
- Optional short note.

Do not force reviewers into a blank long comment box.

### Rate the Raters

Pitch owners should be able to mark received feedback:

- Useful.
- Generic.
- Not helpful.

This protects the system from low-effort review farming and creates the dataset for future reviewer reputation.

### Reviewer Roles Are Not Equivalent

Do not conflate:

- Peer founders.
- Experienced reviewers.
- Organizer team members.
- Public reviewers.

Each has different motivation and should eventually have different UX and permissions.

### Anonymous-to-Crowd, Accountable-to-System

Named peer feedback can become too polite. The direction to test is:

```text
Anonymous-to-the-crowd, accountable-to-the-system.
```

Public display can use role labels, but admin/system data must always preserve accountability.

### Toast/Roast Alone Is Not Enough

Toast/Roast should be the entry point, not the full feedback model.

Feedback should include:

- Toast or Roast.
- Multiple signal chips.
- Optional note.
- Readiness rating:
  - Needs work.
  - Getting there.
  - Pitch-ready.

Avoid long 1-10 scales for MVP feedback. They dilute signal and slow people down.

### Multi-Select Feedback Chips

Users should be able to select more than one feedback signal. Single select is too limiting.

Examples:

- Clear.
- Compelling.
- Strong problem.
- Strong ask.
- Confusing.
- Too broad.
- Weak ask.
- Needs proof.

### Feedback Display

Feedback should be visible per pitch, not hidden in a hard-to-find drawer.

Founders need to see:

- All feedback on a pitch.
- Repeated signals.
- Toast/Roast count.
- Readiness trend.
- What to improve in next version.

## Gamification Decisions

Gamification should build habit, not clutter the interface.

Core loop:

```text
Record -> get useful feedback -> improve score/signal -> repeat tomorrow -> see progress
```

Prioritized habit mechanics:

- Today's Pitch Prompt.
- One-tap Record.
- Pitch Progression:
  - Version 1.
  - Version 2.
  - Version 3.
- Useful Feedback Signal.
- Daily Momentum:
  - Practice days.
  - Pitch reps.
  - Clarity improvement.
  - Best take.
  - Deadline countdown if tied to an event.
- Nudge Timing:
  - Email with specific task.
- Best Take challenge.

Inspired by Duolingo:

- Clear next action.
- Small achievement moments.
- Progress path.
- Daily quests.
- Streak/heatmap.
- Friendly but not childish.

Important user preference:

- The 7-day pitch momentum heatmap in the sidebar was liked. Preserve or restore it when simplifying UI.

Automated notification preference decision:

- Email nudges are the MVP channel for founder practice reminders.
- Daily prompt emails and event deadline reminders should respect founder opt-out state.
- Manual organizer announcements remain separate from automated nudges.

## Design Decisions

### Video Must Stay Primary

The app should feel video-first.

Avoid:

- Overlarge right-side gamification panels.
- Too many metrics around the video.
- Neon colors dominating the screen.
- UI that looks like a dashboard instead of a focused pitch practice room.

Preferred:

- TikTok-like subtle vertical action rail.
- Video centered appropriately.
- Sidebar can be minimizable.
- Right-side content should be contextual and lightweight.
- Full details should be collapsible or opened intentionally.

### Liquid Glass Direction

Liquid glass works well if restrained:

- Feedback modal.
- Invite cards.
- Profile/edit panels.
- Pitch info overlay.

Do not use liquid glass so heavily that the product becomes visually noisy.

### Brand Color Direction

Earlier green/cyan neon was too dominant. Keep brand accents, but use them sparingly.

The product should feel:

- Sharp.
- Premium.
- Calm.
- Founder-serious.
- Slightly playful in moments of progress.

## Event/Organizer Decisions

### Organizer Role Is Invite-Only

Organizer signup should not be public/self-serve in MVP.

Flow:

1. Platform super admin invites organizer.
2. Organizer accepts invite.
3. Organizer creates event/pitch room.
4. Organizer invites team/coaches/mentors/judges/founders.

### Team Roles

Event team roles:

- Organizer.
- Admin.
- Coach.
- Mentor.
- Judge.

Submission review should be visible to organizer team members, not only the organizer.

### Founder vs Organizer Distinction

Do not show organizer-specific event creation as a normal founder menu item.

For founders:

- "Pitch Goal" means personal practice goal/deadline.

For organizers:

- "Pitch Room" or "Program" means event/cohort setup.

Avoid confusing labels like "Pitch Event" in founder navigation.

### Organizer Use Case

GTM/distribution wedge:

- Pitch competitions.
- Demo days.
- Startup cohorts.
- Local founder programs.
- Speed networking and pitch events.

Example upcoming contexts from the user:

- Startup Westport pitch competition, cohort/bootcamp during September 2026, finalists pitch for $25K.
- Ridgefield Shark Tank competition in October 2026.

## Auth Decisions

### Email/Google Now, SMS Later

Preferred MVP auth:

- Google login.
- Email OTP.

Phone/SMS is deferred because:

- It adds Twilio setup.
- It may imply US-only launch.
- It complicates account linking.
- The product is web-first, not native mobile yet.

### Magic Link vs OTP

Email OTP is preferred over magic link because magic links can cause friction across devices.

## Admin Decisions

### Platform Admin Route

The route is:

```text
/pip-super-admin
```

Do not use:

```text
/admin
```

Reason:

- `/admin` is too guessable.
- Hidden path reduces discovery, though it is not the primary security mechanism.

Real security is:

- Signed-in user.
- `platform_admins` table.
- `role = super_admin`.
- Protected service-role server APIs.

### Seeded Super Admin

Seeded super admin:

```text
arun@pitchinpublic.io
```

## Email Decisions

Transactional email uses Resend.

Recommended sender in Vercel:

```text
Pitch in Public <hello@pitchinpublic.io>
```

Do not wrap the Vercel env value in quotes.

Resend must have `pitchinpublic.io` verified and the API key authorized for that domain.

The app strips accidental wrapping quotes defensively.

## Media Decisions

Current media provider:

- Cloudflare Stream.

Near-term:

- Keep Cloudflare Stream unless clear UX/scalability blockers emerge.
- Focus on upload/record/publish/playback stability before switching providers.

Video experience requirements:

- Mobile-first portrait/tall video.
- 60-second default founder pitch.
- Event organizers may configure pitch duration in minutes.
- Validate upload aspect ratio and duration clearly.
- Mobile browser upload must work reliably.

## What Not To Build Yet

Avoid building too early:

- Investor discovery marketplace.
- Complex ranking algorithms.
- DMs.
- Advanced social graph.
- Badges as primary value.
- Multiple startup support for free MVP.
- Complex cohort admission workflow.
- Native mobile app before web loop is proven.

## Recurring User Preferences

- Be direct and honest.
- Push back when strategy is weak.
- Do not make the user manually test obvious UI bugs.
- Verify in browser/Playwright before saying something is fixed.
- Keep UI polished, mobile-first, and responsive.
- Make founder and organizer experiences clearly distinct.
- Preserve a sleek, premium feel; do not overdo childish gamification.
