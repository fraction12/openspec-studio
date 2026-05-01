# Simplify Studio Runner installation

## Why
OpenSpec Studio is understandable as a local OpenSpec inspection app, but the agent execution path currently feels like a lab setup: users need to understand that Studio Runner is powered by a separate Symphony repo, build a runner binary, keep it fresh, configure `WORKFLOW.md`, ensure Codex/GitHub auth works, and diagnose stale binaries or missing remotes.

That is too much surface area for a new user. The product should feel like: install OpenSpec Studio, open an OpenSpec repo, enable Studio Runner, then click **Build with agent**. Symphony can remain the internal implementation, but the user-facing setup should be a managed Studio Runner sidecar with clear diagnostics and an advanced escape hatch.

## What changes
- Define **Studio Runner** as the user-facing companion, even if implemented by the Studio-owned Symphony fork.
- Add a first-run setup/checklist flow for enabling agent execution.
- Require Studio to detect runner binary availability, version, compatibility, endpoint reachability, and health.
- Require auth diagnostics for Codex and GitHub CLI before users dispatch work.
- Require repository readiness diagnostics for OpenSpec presence, GitHub remote, default branch/fetchability, and writable worktree root.
- Prefer a managed/bundled/versioned runner binary path for normal users.
- Keep an advanced custom runner path for developers who want to point Studio at a local Symphony checkout or custom binary.
- Present actionable setup states instead of exposing raw Symphony/Elixir/internal runner concepts.

## Out of scope
- Replacing Symphony as the runner implementation.
- Shipping a cloud runner.
- Auto-installing Codex, GitHub CLI, OpenSpec CLI, or GitHub credentials without user action.
- Changing signed dispatch semantics, workspace isolation, publication rules, or runner event streaming.
- Removing the advanced local runner path used by development builds.

## Impacted specs
- `local-desktop-shell`: Runner setup, managed sidecar lifecycle, compatibility checks, auth/repo diagnostics, and user-facing onboarding.
- `studio-runner-session`: Runner version/compatibility/readiness state and setup diagnostics in normalized runner session state.
