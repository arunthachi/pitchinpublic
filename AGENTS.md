# Pitch in Public Agent Contract

This file is the repository entry point for all coding agents.

## Automatic Task Bootstrap

This bootstrap is mandatory at the start of every new agent task. The user does
not need to repeat it in their prompt.

1. Confirm the current repository path, worktree/branch, and `git status`.
2. Read this file completely.
3. Read the two canonical handbooks in order:
   - `docs/product/PITCH_IN_PUBLIC_PRODUCT_HANDBOOK.md`
   - `docs/codex/PITCH_IN_PUBLIC_CODEX_HANDBOOK.md`
4. Inspect relevant source, migrations, tests, recent commits, and specialist
   files in `docs/agent/` before making assumptions.
5. Summarize material constraints internally, then execute the user's task.

For trivial changes, agents may scan the canonical handbooks for relevant
sections instead of rereading every line, but their requirements still apply.
Conversation history is never a substitute for repository documentation.

For non-trivial work, follow the reviewed planning and approval gate described
below before editing. Do not ask the user to restate these bootstrap rules.

## Minimal New-Task Prompt

When Codex is started from this repository or either release worktree, the user
only needs to provide the task, for example:

```text
Fix the feedback submission failure in staging, verify the root cause, and test
the responsive founder flow. Do not deploy until I approve.
```

If an agent has not loaded this contract and the canonical handbooks, it must do
so automatically before proceeding.

## Product Truth

Pitch in Public is a mobile-first pitch gym, not a generic startup discovery network.

```text
Record -> Useful feedback -> Improve -> Repeat -> Best Take
```

The organizer product helps cohorts and pitch events turn preparation into a guided practice program.

## Source Precedence

1. Observed deployed behavior and configuration.
2. Current release code and ordered migrations.
3. Reproducible tests and API/browser evidence.
4. Canonical product and Codex handbooks.
5. Supporting runbooks, issues, PRs, and conversation history.

When sources conflict, report the discrepancy. Do not invent a resolution.

## Status Language

Use `Current`, `Verify`, `Planned`, `Proposed`, `Deferred`, or `Removed`. Never claim completion without code, checks, environment, and role evidence.

## Release Worktrees

```text
/Users/arunthachi/project/worktrees/pitchinpublic/test-env
/Users/arunthachi/project/worktrees/pitchinpublic/main
```

Verify paths and branches before editing. `test-env` is staging integration; `main` is production. Use `codex/<scope>` for new feature branches unless directed otherwise.

## Mandatory Gates

- Non-trivial work requires a reviewed, approved plan before implementation.
- Schema changes require ordered migrations and RLS allow/deny tests.
- User-facing work requires mobile-first browser validation.
- Release work goes to `test-env`, is verified in staging, then is promoted to `main`.
- Do not claim “fixed” or “deployed” until the relevant environment is checked.

## Engineering Guardrails

- Keep video and the next useful action primary.
- Preserve founder, organizer, reviewer, and platform-admin role boundaries.
- Never rely on hidden UI for authorization.
- Keep service-role credentials server-side.
- Do not expose internal database UUIDs in user-facing URLs when public IDs can be used.
- Preserve unrelated local changes and untracked artifacts.
- Do not force-push or use destructive git commands.
- Do not commit secrets, recordings, screenshots, or generated test artifacts.
- Keep edits scoped and follow existing code patterns.

## Required Verification

As applicable, run:

```bash
npm run lint
npm run build
```

Run relevant package test scripts plus Playwright and real-Chrome flows for media/auth behavior. Test signed-out, authorized, unrelated authenticated, wrong-role, and expired/revoked-invite cases.

Mobile acceptance is mandatory at 320, 375, 390, and 430 pixel widths. Modals/drawers must scroll, primary actions must remain reachable, and the keyboard must not hide active inputs.

## Definition of Done

Implementation, focused tests, security checks, responsive QA, migration verification, staging evidence, documentation updates, and stated residual risks are all required. A commit or PR alone is not done.
