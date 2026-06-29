# Auth, Video UX, and Media Provider Plan

Date: 2026-06-29
Branch: test-env
Base branch: claude/pitch-public-mvp-frontend-0134Ki1GfD56ukT315MzVSkh
Current commit before this plan: 940ea11

## Goal

Make Pitch in Public easier to join and easier to post a high-quality 60-second pitch, while avoiding an unnecessary media-provider migration before the product has proven its exact video requirements.

## Current Code Facts

- `src/components/SignInModal.tsx` already supports Supabase OAuth for Google and X/Twitter via `google` and `twitter`.
- LinkedIn OAuth is not present. Supabase's current LinkedIn option should be wired as `linkedin_oidc`.
- `src/app/auth/callback/route.ts` already exchanges OAuth codes for sessions.
- `src/components/RecordingStudio.tsx` owns the main record/upload/post flow.
- `src/components/VideoUpload.tsx` is a separate upload component with a similar provider-upload flow, but it is not the main studio flow.
- There are two upload URL endpoints:
  - `src/app/api/pitches/upload-url/route.ts`: authenticated GET, directly instantiates `CloudflareStreamProvider`.
  - `src/app/api/videos/upload-url/route.ts`: POST, provider abstraction, but no auth check.
- `src/lib/video-providers/index.ts` has an abstraction for `cloudflare | mux | bunny`, but only Cloudflare is implemented.
- `src/app/api/pitches/route.ts` hard-codes `video_provider: 'cloudflare'`.
- `src/components/VideoPlayer.tsx` supports HLS via `hls.js`, plus native HLS on Safari and MP4 fallback.

## Product Position

The app is not mainly "startup idea discovery." It is daily pitch practice. The core user job is:

1. Record a 30-60 second pitch quickly.
2. Know whether the pitch is acceptable before upload.
3. Add enough context for useful feedback.
4. Publish with confidence.
5. Get Toast/Roast feedback and improve the next take.

The implementation should optimize that loop before optimizing vendor optionality.

## Implementation Plan

### 1. Signup And Login Providers

Scope:
- Update `SignInModal` to support Google, X, and LinkedIn.
- Rename UI copy from only "sign in" to "sign up or log in" where the modal is used. Supabase OAuth handles both new and returning users.
- Add a LinkedIn button using provider `linkedin_oidc`.
- Keep X wired to provider `twitter`.
- Update `.env.example` and `SUPABASE_SETUP.md` to say: enable Google, Twitter/X, and LinkedIn OIDC in Supabase Auth providers, and add `/auth/callback` redirect URL.

Implementation details:
- Replace the narrow provider union in `SignInModal` with:
  `type OAuthProvider = 'google' | 'twitter' | 'linkedin_oidc';`
- Use a provider config array so buttons do not duplicate loading/error logic.
- Keep manual redirect with `data.url` because the current code already compensates for redirect issues.
- Improve error copy for provider-not-enabled cases: "This login provider is not enabled yet. Check Supabase Auth providers."

Acceptance criteria:
- Modal shows Google, X, and LinkedIn.
- Each button calls `supabase.auth.signInWithOAuth` with the correct provider.
- Loading state is per selected provider.
- TypeScript passes.

### 2. Video Management UX

Scope:
- Fix the record/upload flow users actually touch: `RecordingStudio`.
- Reduce endpoint duplication and make provider use consistent.
- Improve confidence during upload and processing.

UX changes:
- Rename "Post Pitch" in preview to "Continue" because the pitch is not created until the final "View Feed" button today. This is currently misleading.
- Add an explicit stepper: Record/Upload -> Preview -> Pitch Details -> Publish.
- Show the 30-60 second rule before recording and uploading.
- During recording, keep the countdown and timer, but add clearer minimum/maximum state:
  - 0-29s: "Keep going, 30s minimum"
  - 30-55s: "Good length"
  - 56-60s: "Wrap up"
- Add "Retake" on preview.
- During upload, separate "Uploading" from "Processing" so users know if the network upload is done but Cloudflare is still preparing playback.
- Poll provider metadata after direct upload until status is ready, with timeout and helpful retry.
- Keep the final publish step, but create the pitch before claiming "Pitch Posted."

Engineering changes:
- Use `src/app/api/videos/upload-url/route.ts` as the single upload URL endpoint.
- Add auth validation to `api/videos/upload-url`.
- Make `RecordingStudio` call the POST endpoint and read `{ success, data }`.
- Remove or redirect `api/pitches/upload-url` after callers are migrated, or leave as a compatibility wrapper that delegates to the shared provider endpoint.
- Create a small client helper for XMLHttpRequest upload with progress instead of duplicating the logic across `RecordingStudio` and `VideoUpload`.
- Store `video_provider` from the provider response rather than hard-coding Cloudflare in pitch creation.

Acceptance criteria:
- Authenticated user can record a 30-60 second pitch and publish.
- Authenticated user can upload a valid video and publish.
- Invalid duration gives immediate feedback.
- Upload and processing states are visually distinct.
- Pitch is not labeled as posted until `POST /api/pitches` succeeds.
- Existing feed playback still works for HLS and MP4.

### 3. Media Provider Strategy

Recommendation: Keep Cloudflare Stream for now, but clean up the provider boundary so switching is cheap later.

Rationale:
- The app's current video needs are simple: short vertical videos, direct upload, HLS playback, thumbnails, duration validation, delete, and basic analytics.
- Cloudflare Stream already supports direct upload and the current code is written around it.
- The main current weakness is not Cloudflare itself. It is product flow and code integration:
  - duplicated upload endpoints,
  - no unified processing state,
  - hard-coded provider at pitch creation,
  - incomplete signed playback implementation,
  - no provider capability model.
- Switching to Mux now would introduce migration and billing/API work before the UX bottlenecks are fixed.

What to improve now:
- Add provider capability fields to `VideoProvider`, such as:
  - `supportsDirectUpload`
  - `supportsSignedPlayback`
  - `supportsThumbnails`
  - `supportsAnalytics`
  - `supportsWebhooks`
- Add `provider` to `UploadUrlResult`.
- Store provider in the pitch row from the provider response.
- Add a provider metadata polling contract that returns `processing | ready | error`.
- Add a future webhook route placeholder for provider processing events.

When to reconsider Mux:
- If feed startup time, seek performance, or processing reliability is measurably hurting activation.
- If we need richer per-view analytics, webhook-driven lifecycle, captions, animated thumbnails, or moderation tooling.
- If creator upload failures become a top support issue and Mux's tooling materially reduces that.

Do not switch media providers in this implementation unless Cloudflare fails the acceptance tests.

## Review Report

### CEO Review

Verdict: implement auth and video UX now; do not start with a provider migration.

Why:
- Signup friction directly blocks growth.
- Recording and posting friction directly blocks supply.
- Provider migration does not improve the product unless upload/playback UX is already clean enough to measure.

Risk:
- Adding LinkedIn OAuth depends on Supabase dashboard configuration. Code alone cannot make it work.
- If Cloudflare credentials are not configured locally, upload testing will need staging credentials.

### Design Review

Verdict: the main UX problem is confidence and sequencing.

Findings:
- Current recording flow says "Post Pitch" before the pitch exists, which creates a trust gap.
- Users need a visible practice frame: length target, retake, preview, details, publish.
- Upload/processing should be split because direct-upload video products often finish upload before playback is ready.

Design requirements:
- Keep UI dense and app-like, not a marketing modal.
- Use existing dark/neon visual language, but reduce over-bright states.
- Treat the 60-second limit as coaching, not punishment.

### Engineering Review

Verdict: consolidate the upload path before adding vendor implementations.

Dependency graph:

```text
RecordingStudio
  -> /api/videos/upload-url
    -> getVideoProvider()
      -> CloudflareStreamProvider
  -> /api/videos/[videoId] or /api/videos/metadata
  -> /api/pitches
    -> Supabase pitches row
VideoPlayer
  -> HLS.js/native HLS/MP4 playback
```

Required code changes:
- `SignInModal.tsx`
- `.env.example`
- `SUPABASE_SETUP.md`
- `RecordingStudio.tsx`
- possibly `VideoUpload.tsx` if sharing upload helpers
- `src/app/api/videos/upload-url/route.ts`
- `src/app/api/pitches/upload-url/route.ts`
- `src/app/api/pitches/route.ts`
- `src/lib/video-providers/types.ts`
- `src/lib/video-providers/index.ts`
- `src/lib/video-providers/cloudflare-stream.ts`

Testing:
- `npx tsc --noEmit`
- auth modal browser smoke test
- recording modal state-machine smoke test
- upload endpoint auth test by unauthenticated request returns 401
- provider config missing test returns helpful error
- manual staging upload if Cloudflare credentials are available

### DX Review

Verdict: update environment docs while touching auth/media.

Needed docs:
- Supabase OAuth provider setup:
  - Google
  - X/Twitter
  - LinkedIn OIDC
  - redirect URL `/auth/callback`
- Media env setup:
  - `VIDEO_PROVIDER=cloudflare`
  - Cloudflare account ID
  - Cloudflare Stream API token
- Local testing note:
  - use real Supabase credentials for auth
  - use real Cloudflare credentials for upload
  - otherwise run type checks and UI-only flow checks

## Sequencing

1. Implement auth provider UI and docs.
2. Consolidate upload URL endpoint around `api/videos/upload-url`.
3. Update provider interfaces to return provider identity and capability metadata.
4. Update `RecordingStudio` flow labels and state transitions.
5. Make pitch creation use provider identity instead of hard-coded Cloudflare.
6. Run type checks and browser smoke tests.
7. If Cloudflare credentials are available, test full upload in staging.

## Open Decisions For Approval

1. Approve keeping Cloudflare Stream for this pass and improving the abstraction instead of switching to Mux now.
2. Approve treating Google/X/LinkedIn OAuth as one "sign up or log in" modal rather than separate sign-up and login screens.
3. Approve consolidating video upload through `/api/videos/upload-url` and keeping `/api/pitches/upload-url` only as a compatibility wrapper or deleting it if no callers remain.

## GSTACK REVIEW REPORT

- CEO: pass with recommendation to avoid premature media migration.
- Design: pass with required upload/processing sequencing changes.
- Engineering: pass with required endpoint consolidation and provider-boundary cleanup.
- DX: pass with required Supabase and Cloudflare setup documentation updates.
- Implementation status: blocked pending user approval, per repository review-before-build rule.
