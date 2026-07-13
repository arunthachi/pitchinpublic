# Pitch in Public Agent Workflows

Last updated: 2026-07-13

## Before Building

For non-trivial work:

1. Read [CONTEXT.md](CONTEXT.md).
2. Read [MEMORY.md](MEMORY.md).
3. Read the relevant section of [PRODUCT_SPEC.md](PRODUCT_SPEC.md).
4. Inspect current code before assuming implementation details.
5. Make a short implementation plan.
6. If the work affects product strategy, UX, auth, DB, video, or organizer workflow, be explicit about tradeoffs before editing.

For trivial fixes:

- Inspect the affected file.
- Patch narrowly.
- Run the relevant check.

## Development Commands

Install:

```bash
npm install
```

Dev:

```bash
npm run dev
```

Lint:

```bash
npm run lint
```

Build:

```bash
npm run build
```

Supabase migration dry run:

```bash
npx supabase db push --dry-run
```

Apply linked staging migrations:

```bash
npx supabase db push --yes
```

Migration list:

```bash
npx supabase migration list
```

## Git Workflow

Default branch for active work:

```text
test-env
```

Do not force-push.

Do not hard reset.

Do not revert unrelated local changes.

When done:

1. `git status --short`
2. Run checks.
3. Commit with clear message.
4. Push to `origin test-env`.
5. Verify staging deploy if the change affects runtime.

## Verification Matrix

### General Frontend

Run:

```bash
npm run lint
npm run build
```

Browser test:

- Desktop viewport.
- Mobile viewport.
- No obvious console errors.
- No modal overflow.
- Buttons visible and tappable.
- Long text does not overlap.

### Recording/Upload

Test:

- Desktop upload.
- Mobile upload where possible.
- Portrait validation.
- Duration validation.
- Recording timer.
- Stop/preview behavior.
- Upload progress.
- Publish success.
- Published video appears in feed/profile.

### Feedback

Test:

- Toast.
- Roast.
- Multiple chips.
- Optional note.
- Readiness.
- Submit without required long text if signal exists.
- Feedback appears on pitch.
- Counts update.
- Confetti/animation does not block next action.

### Profile/Startup

Test:

- Edit founder profile.
- Add startup info.
- Startup info prepopulates upload.
- Own pitches are visible in a profile-like page.
- Best Take can be marked.

### Organizer

Test:

- Super admin creates invite.
- Email status is visible.
- Invite link can be copied.
- Organizer accepts invite with matching email.
- Organizer creates event.
- Organizer sets pitch length in minutes.
- Organizer invites team and founders.
- Founder joins event.
- Founder submission appears in dashboard.

### Platform Admin

Route:

```text
/pip-super-admin
```

Verify:

- `/admin` returns 404.
- `/api/admin/overview` returns 404.
- `/pip-super-admin` renders sign-in gate unauthenticated.
- `/api/pip-super-admin/overview` returns 401 unauthenticated.
- Signed-in super admin can load overview.
- Non-admin user gets 403.

## Route Ownership

### Marketing

Files:

```text
src/app/page.tsx
src/app/founders/page.tsx
src/app/for-events/page.tsx
src/components/LeadCaptureModal.tsx
```

Responsibilities:

- Founder landing.
- Organizer landing.
- Lead capture.
- Contact email.
- SEO/Open Graph.

### Founder App

Files:

```text
src/app/page.tsx
src/app/me/page.tsx
src/app/profile/[userId]/page.tsx
src/app/pitch/[id]/page.tsx
src/components/FullScreenVideoFeed.tsx
src/components/RecordingStudio.tsx
src/components/FeedbackModal.tsx
src/components/PitchHabitPanel.tsx
src/components/PitchGoalPanel.tsx
src/components/SidebarNav.tsx
```

Responsibilities:

- Feed.
- Recording/upload.
- Feedback.
- Profile.
- Momentum.
- Daily practice.

### Organizer App

Files:

```text
src/app/events/new/page.tsx
src/app/events/[slug]/page.tsx
src/app/events/[slug]/dashboard/page.tsx
src/app/organizer/invite/page.tsx
src/app/api/events/*
src/app/api/organizer-invites/accept/route.ts
```

Responsibilities:

- Invite-only organizer access.
- Event creation.
- Team/founder invites.
- Event dashboard.
- Submissions and announcements.

### Platform Admin

Files:

```text
src/app/pip-super-admin/page.tsx
src/app/pip-super-admin/layout.tsx
src/app/api/pip-super-admin/*
src/lib/admin.ts
src/lib/email.ts
```

Responsibilities:

- Super admin overview.
- Organizer invite creation/resend.
- Email delivery status.

### Data and Business Logic

Files:

```text
src/lib/data.ts
src/lib/gamification.ts
src/lib/practice.ts
src/lib/validation.ts
src/lib/video-providers/*
src/lib/supabase/*
```

Responsibilities:

- Data mapping.
- Practice loop.
- Streak/momentum.
- Validation.
- Cloudflare Stream integration.
- Supabase clients.

## Database Workflow

Use migrations for schema changes:

```text
supabase/migrations
```

Guidelines:

- Add columns with defaults when needed for existing rows.
- Keep RLS in mind.
- Use service role only server-side.
- Backfill old pitch rows when new columns are added.
- For roles/permissions, prefer explicit tables over metadata-only checks.

Before applying:

```bash
npx supabase db push --dry-run
```

After applying:

```bash
npx supabase migration list
```

## Email Workflow

Email helper:

```text
src/lib/email.ts
```

Provider:

```text
Resend
```

Recommended sender:

```text
Pitch in Public <hello@pitchinpublic.io>
```

Common failures:

- Missing `RESEND_API_KEY`.
- Sender domain not verified.
- API key not authorized for `pitchinpublic.io`.
- Vercel env value accidentally wrapped in quotes.

Dashboard should surface provider errors instead of hiding them.

## Video Workflow

Provider:

```text
Cloudflare Stream
```

Key files:

```text
src/lib/video-providers/cloudflare-stream.ts
src/app/api/videos/upload-url/route.ts
src/app/api/pitches/upload-url/route.ts
src/components/RecordingStudio.tsx
src/components/VideoUpload.tsx
src/components/VideoPlayer.tsx
```

Rules:

- Make mobile upload reliable.
- Treat portrait/tall video as default.
- Show friendly copy for rejected aspect ratio or duration.
- Avoid developer-facing Cloudflare/HLS errors in user UI.
- Handle processing states.

## UI/UX Guardrails

### Mobile First

Every modal and page must work on:

- iPhone-sized viewport.
- Laptop viewport.
- Desktop wide viewport.

Avoid:

- Fixed-height modals that overflow.
- Buttons below viewport.
- Non-scrollable overlays.
- Dense right rails on desktop.
- Excessive neon.

### Feedback Overlay

Feedback overlay should:

- Fit inside phone/video frame.
- Leave some background video visible.
- Use liquid glass sparingly.
- Not cut off fields.
- Support multi-select chips.

### Recording Modal

Recording modal should:

- Fit different laptop heights.
- Avoid giant red timer blocking the face.
- Make minimum duration rules simple.
- Show clear cancel/preview/stop state.

## Release Notes Habit

When meaningful changes ship, update at least one of:

- `docs/agent/MEMORY.md` for decisions.
- `docs/agent/PRODUCT_SPEC.md` for product behavior.
- `docs/agent/CONTEXT.md` for routes/env/schema changes.
- `docs/agent/ROADMAP.md` for phase movement.
