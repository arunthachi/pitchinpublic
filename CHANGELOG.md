# Changelog

## [0.2.3] - 2026-08-29

### Added

- Founders can see feedback they received and feedback they gave from their own profile, without exposing private reviewer identity.

### Changed

- Review queues now open from one database snapshot, invalidate stale assignments clearly, and allow replacement assignments when eligibility changes.
- Reviewer access changes preserve valid in-progress work through alternate roles and invalidate only assignments that are no longer eligible.
- Event and profile pages keep pitch data visible when feedback enrichment is temporarily unavailable and offer a recoverable retry state.

### Fixed

- Recorded pitches, public pitch totals, and leaderboard counts now use the same canonical visibility rules, so private or deleted pitches cannot distort totals.
- Event submission, visibility changes, deletion, feedback submission, and review assignment updates now use atomic database contracts that prevent stale or partially applied state.
- Legacy event submissions remain atomic during the database-first mixed-version rollout, while feedback identities stay anonymous outside their assignment-scoped accountability roles.
- Large events load feedback in bounded batches without dropping pitches or failing after the first 100 records.
- Production dependencies and database-contract CI are pinned to patched, reproducible versions.

## [0.2.2] - 2026-08-12

### Changed

- Founders can select a clear business stage from Idea, Pre-revenue, Revenue-generating, Growth, or Established in the event pitch plan and recording studio.
- Industry is now a searchable suggestion field with broad cross-sector categories while still accepting a founder’s own description.

## [0.2.1] - 2026-08-12

### Fixed

- Organizers can now publish the recommended Pitch Standard for events created before Pitch Standards launched; setup errors also explain how to recover instead of displaying “Required.”

## [0.2.0] - 2026-08-12

### Added

- Organizers can create an event quickly, then tailor and publish a reusable Pitch Standard with four to six plain-language criteria and founder instructions.
- Founders see the event’s Pitch plan before recording and inside the recording studio, with their preparation saved while an uploaded take remains intact.
- Reviewers evaluate each take against the exact Pitch Standard version used to record it and give criterion-bound observations plus a practical next step.
- Product, roadmap, workflow, and agent guidance now document the founder-improvement loop and the Tiger Shark Tank pilot constraints.

### Changed

- Structured event pitches are private while founders practice and can be submitted only through a trusted event recording session.
- Feedback identity supports named, role-only, or founder-anonymous disclosure without losing internal accountability.

### Fixed

- Event creation retries, Pitch Standard publishing, all-day deadlines, recording setup failures, legacy pitch candidates, and feedback retries now preserve the correct server-authoritative state.
- Reviewer and founder views retain Pitch Standard provenance and structured feedback after reload.
