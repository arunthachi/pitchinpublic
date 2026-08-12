---
name: pitch-in-public
description: Use when working on Pitch in Public, including structured pitch guidance, founder practice actions, organizer pitch rooms, feedback, recording, platform admin, Supabase, video, email, marketing, or launch strategy.
---

# Pitch in Public Skill

Use this project-local skill before changing Pitch in Public.

## Required Reading

For any non-trivial task, read:

1. `AGENTS.md`
2. `docs/product/PITCH_IN_PUBLIC_PRODUCT_HANDBOOK.md`
3. `docs/codex/PITCH_IN_PUBLIC_CODEX_HANDBOOK.md`
4. Relevant source files and ordered database migrations
5. Relevant specialist context in `docs/agent/`

The canonical handbooks supersede conflicting status or workflow claims in older agent documents.

## Truth and Evidence Protocol

- Treat deployed behavior, current release code, migrations, and reproducible tests as evidence.
- Label uncertain status as `Verify`; do not infer completion from file presence.
- Separate current behavior from planned behavior.
- Never claim a migration, deployment, email delivery, video processing result, or RLS guarantee without checking it.
- Report discrepancies instead of silently choosing the convenient source.

## Core Product Truth

Pitch in Public is not primarily "TikTok for startup ideas."

It is:

```text
A public pitch gym where founders record, get roasted/toasted, improve, and build confidence.
```

Core loop:

```text
First Take -> Roast/Toast feedback -> Better Take -> Best Take -> Featured/Submitted
```

Current north star:

```text
Structured feedback -> selected practice focus -> sharper next pitch
```

For event work, preserve the integrated pilot contract: short event creation atomically creates an unpublished universal Pitch Standard; the organizer uses or customizes and explicitly publishes it; the founder sees one Pitch plan before and around recording; every take is atomically bound to the exact published version from a trusted recording session; review supplies criterion-linked `What I noticed` plus `Try this next`; accountable reviewer identity follows the event's disclosure policy; and a later take can address selected practice actions. AI guidance is planned, not shipped, so do not present human feedback as AI output or add generation without an approved AI safety and evaluation plan.

The default standard must use plain, category-neutral language. Stage and industry are optional context. Founder practice must not depend on reviewer recruitment, assignments, or completed feedback. During active recording the Pitch plan must not cover or interrupt the video.

## Main Personas

- Founder: practices and improves a pitch.
- Organizer: runs a pitch room for a competition, cohort, demo day, or founder program.
- Platform admin: internally invites organizers and monitors founders/events.

## Route Anchors

Founder:

```text
/
/me
/profile/[publicId]
/pitch/[id]
```

Organizer:

```text
/organizer/invite
/events/new
/events/[slug]
/events/[slug]/dashboard
```

Platform admin:

```text
/pip-super-admin
```

Do not recreate `/admin`.

## Build Guardrails

- Keep video primary.
- Keep founder workflow dead simple.
- Preserve mobile-first responsive behavior.
- Treat mobile acceptance as mandatory on every user-facing screen.
- Avoid overbuilding social/discovery features before the practice loop works.
- Do not make organizer features visible as normal founder actions.
- Use explicit DB migrations for schema changes.
- Protect service-role operations server-side only.
- Run lint/build and browser checks before claiming completion.
- Test authorization with signed-out, authorized, unrelated, and wrong-role actors.
- Test exact guideline-version behavior when an organizer publishes a new version after a founder starts preparing a take.

## Common Commands

```bash
npm run lint
npm run build
npx supabase db push --dry-run
npx supabase migration list
```

## High-Risk Areas

- Mobile video upload/recording.
- Feedback save/display.
- Pitch profile/startup data duplication.
- Event invite permissions.
- Platform admin security.
- Resend sender/domain configuration.
- Cloudflare Stream processing/playback states.

## Current Strategic Priority

Verify and run the controlled pitch-guidance pilot. Measure actionable feedback, feedback within 48 hours, later takes, guidance addressed, and repeat reviewers. Seed review supply manually before building allocation v2 or a new credit economy.

Do not let the app drift into a broad social feed before the daily pitch practice and structured feedback behavior is validated.
