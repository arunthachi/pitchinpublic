# Pitch in Public Context

Last updated: 2026-07-13

## Working Location

Primary active worktree:

```text
/Users/arunthachi/project/worktrees/pitchinpublic/test-env
```

Branch:

```text
test-env
```

The repo was originally split into a raw repository under `/Users/arunthachi/project/repos/pitchinpublic` and worktrees under `/Users/arunthachi/project/worktrees/pitchinpublic`.

Use `test-env` for staging work unless the user explicitly asks to promote to production/main.

## Product Summary

Pitch in Public is a founder pitch practice product.

The current strategic positioning is not "TikTok for startup ideas." That wording is misleading because it implies idea discovery and entertainment. The sharper positioning is:

> A public pitch gym where founders record, get Roast/Toast feedback, improve, and build confidence.

The core loop:

```text
First Take -> Roast/Toast feedback -> Better Take -> Best Take -> Featured/Submitted -> Invite another founder
```

Near-term launch strategy:

1. Free private pilot with selected founders.
2. Learn behavior and stabilize the app.
3. Paid "Pitch Without Fear Sprint."
4. Public launch after the practice/feedback loop proves retention.

## Key Audiences

### Founders

Early founders, indie builders, and startup operators who struggle to explain what they are building clearly and confidently.

Their pain:

- They do not practice pitching daily.
- Their pitch is vague, rambly, or too product-focused.
- They struggle to name the customer, pain, urgency, differentiation, and ask.
- They need safe, constructive feedback before a real room, investor, customer, event, or judge.

### Organizers

Pitch competitions, demo days, accelerators, startup cohorts, founder bootcamps, business groups, universities, and local entrepreneur programs.

Their pain:

- Founders often practice only right before pitch day.
- Organizers need a lightweight way to help founders improve before the final event.
- Coaches, mentors, judges, and organizers need visibility into submissions and progress.
- Event finalists need one stronger "best take" to submit or review.

### Platform Admin

Internal Pitch in Public operator role. Currently seeded for:

```text
arun@pitchinpublic.io
```

Super admin dashboard:

```text
/pip-super-admin
```

Do not expose `/admin`; the dashboard intentionally moved away from that path.

## Current Stack

- Next.js App Router, currently Next.js 16.
- React 19.
- TypeScript.
- Tailwind CSS.
- Supabase Auth, Postgres, RLS.
- Cloudflare Stream for video direct upload and playback.
- Resend for transactional email.
- Vercel for web deployment.
- GTM supported by env.

Important packages:

- `@supabase/ssr`
- `@supabase/supabase-js`
- `framer-motion`
- `lucide-react`
- `qrcode.react`
- `zod`

## Primary Domains

Marketing/public:

```text
https://pitchinpublic.io
```

App target:

```text
https://app.pitchinpublic.io
```

Staging:

```text
https://staging-pip.pitchinpublic.io
```

The user also owns:

```text
pitchinpublic.app
```

This may later redirect to the app or host a PWA-focused experience.

## Auth Direction

Current preferred auth strategy:

- Google sign-in.
- Email OTP for low-friction non-Google users.
- QR handoff for desktop-to-mobile recording can be added.

Do not prioritize phone login/SMS for MVP unless the user explicitly reopens it.

Reason:

- SMS adds setup, cost, regional scope, and identity-linking complexity.
- Users are testing via desktop and phone web, not a native app yet.
- Email is needed anyway for nudges and event communications.

Identity principles:

- A user can later have multiple identities linked to one profile, but MVP should avoid complex account linking.
- Email/Google auth can share the same email identity through Supabase.
- Phone auth may be revisited after product behavior is validated.

## Core Routes

Founder app:

```text
/
/me
/profile/[userId]
/pitch/[id]
/leaderboard
```

Marketing:

```text
/
/founders
/for-events
/about
/contact
/terms
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

Legacy/pilot:

```text
/pilot
/pilot/admin
```

Treat legacy pilot pages carefully. Do not expand them without checking whether they conflict with the clearer founder/organizer split.

## Core APIs

Founder:

```text
/api/pitches
/api/pitches/upload-url
/api/pitches/[pitchId]/feedback
/api/pitches/[pitchId]/reaction
/api/pitches/[pitchId]/best-take
/api/pitches/[pitchId]/bookmark
/api/pitches/[pitchId]/view
/api/practice/today
/api/practice/goals
/api/user/streak
/api/user/achievements
```

Video:

```text
/api/videos/upload-url
/api/videos/metadata
/api/videos/[videoId]
```

Events:

```text
/api/events
/api/events/[slug]
/api/events/[slug]/invites
/api/events/[slug]/join
/api/events/[slug]/submission
/api/events/[slug]/announcements
```

Platform admin:

```text
/api/pip-super-admin/overview
/api/pip-super-admin/organizer-invites
/api/pip-super-admin/organizer-invites/[inviteId]/send
```

Public lead capture:

```text
/api/leads
```

## Database Migration State

Migrations currently present:

- `001_create_core_schema.sql`
- `002_add_gamification_tables.sql`
- `003_add_triggers_and_functions.sql`
- `004_make_company_id_optional.sql`
- `005_add_soft_delete_to_pitches.sql`
- `006_add_follows_table.sql`
- `007_add_event_pilot_workflow.sql`
- `008_add_practice_habit_loop.sql`
- `009_add_founder_startup_foundation.sql`
- `010_add_lead_requests.sql`
- `011_add_event_team_workflow.sql`
- `012_add_organizer_invites.sql`
- `013_add_platform_admins.sql`
- `014_add_invite_email_delivery_status.sql`

Staging had migrations through `014` applied as of 2026-07-11.

## Important Env Vars

Supabase:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Video:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_STREAM_TOKEN
```

Email:

```text
RESEND_API_KEY
LEAD_EMAIL_FROM
LEAD_EMAIL_TO
LEAD_EMAIL_CC
```

Recommended `LEAD_EMAIL_FROM` in Vercel:

```text
Pitch in Public <hello@pitchinpublic.io>
```

Do not include wrapping quotes in Vercel UI values.

Analytics:

```text
NEXT_PUBLIC_GTM_ID
```

App URL:

```text
NEXT_PUBLIC_APP_URL
```

For staging:

```text
https://staging-pip.pitchinpublic.io
```

## Security Notes

- `/pip-super-admin` is hidden and noindexed, but the real protection is auth plus the `platform_admins` table.
- Admin APIs require a signed-in platform admin.
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the client.
- Organizer invite acceptance must validate the signed-in email against the invite email.
- Event team actions should be restricted to organizer/admin roles.
- Avoid logging secrets or full provider tokens.

## Design Direction

The product is mobile-first web and should feel app-like.

Current design direction:

- Dark, focused, video-first.
- Liquid glass panels when used.
- Less neon dominance than earlier iterations.
- Subtle interaction rail like TikTok, not large distracting gamification panels beside the video.
- Gamification should support the daily practice habit, not overpower the pitch video.

Key feedback already received:

- Too much right-side content creates cognitive load.
- The video must remain the primary focus.
- Progress and gamification should be glanceable and contextual.
- Founder onboarding must be dead simple.

## Verification Expectations

Before claiming a frontend feature is ready:

- Run `npm run lint`.
- Run `npm run build`.
- Use Playwright/browser smoke testing for affected routes.
- Check desktop and mobile viewport behavior for any modal, recording, feed, or profile changes.
- For DB/API changes, test unauthenticated and authenticated failure paths where possible.

Existing lint warnings are mostly `next/no-img-element` and hook dependency warnings; do not claim they are new unless your change introduced them.
