---
name: pitch-in-public
description: Use when working on the Pitch in Public product, including founder pitch recording, Roast/Toast feedback, practice habit loops, organizer pitch rooms, platform admin, Supabase schema, Cloudflare Stream video, Resend email, marketing pages, or launch strategy.
---

# Pitch in Public Skill

Use this project-local skill before changing Pitch in Public.

## Required Reading

For any non-trivial task, read:

1. `docs/agent/CONTEXT.md`
2. `docs/agent/MEMORY.md`
3. The relevant section of `docs/agent/PRODUCT_SPEC.md`

For implementation/release workflow, read:

- `docs/agent/WORKFLOWS.md`

For prioritization, read:

- `docs/agent/ROADMAP.md`

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

## Main Personas

- Founder: practices and improves a pitch.
- Organizer: runs a pitch room for a competition, cohort, demo day, or founder program.
- Platform admin: internally invites organizers and monitors founders/events.

## Route Anchors

Founder:

```text
/
/me
/profile/[userId]
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
- Avoid overbuilding social/discovery features before the practice loop works.
- Do not make organizer features visible as normal founder actions.
- Use explicit DB migrations for schema changes.
- Protect service-role operations server-side only.
- Run lint/build and browser checks before claiming completion.

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

Prepare the product for a controlled founder/private pilot and invite-only organizer use.

Do not let the app drift into a broad social feed before the daily pitch practice and structured feedback behavior is validated.
