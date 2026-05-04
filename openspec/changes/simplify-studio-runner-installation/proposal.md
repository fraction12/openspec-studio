# Simplify Studio Runner installation

## Why
OpenSpec Studio should not ask normal users to clone, build, and operate two separate repos before they can use **Build with agent**. The current path exposes too much of the lab setup: users need to know that Studio Runner is powered by a separate Symphony repo, build a runner binary, keep it fresh, configure `WORKFLOW.md`, ensure Codex/GitHub auth works, and diagnose stale binaries or missing remotes.

That is the wrong product shape. The user promise should be: install OpenSpec Studio, open an OpenSpec repo, complete a short in-app Runner setup, then click **Build with agent**. Symphony can remain the implementation under the hood, but OpenSpec Studio must own installation, update, compatibility, lifecycle, diagnostics, and recovery for the local runner sidecar.

## Product direction
Studio Runner becomes a **Studio-managed local sidecar**, not a second repository the user manages manually.

The primary path is:

1. User installs or updates OpenSpec Studio.
2. Studio includes, downloads, or installs the compatible Studio Runner sidecar through an in-app setup flow.
3. User opens a local OpenSpec repository.
4. Studio checks runner, auth, repository, workspace, and publication readiness.
5. User clicks **Build with agent**.

The advanced path remains available for developers who deliberately want to point Studio at a custom runner binary, local Symphony checkout, or custom localhost endpoint.

## What changes
- Define **Studio Runner** as the only user-facing runner product surface; Symphony/Elixir are implementation details.
- Replace the “clone/build a second repo” expectation with a managed sidecar install/update/start/stop flow owned by Studio.
- Add a first-run setup/checklist flow for enabling agent execution.
- Move runner repository/binary selection out of build-time env and hardcoded developer paths into runtime app state with auto-detection, a folder/binary chooser, and repair actions.
- Add a `doctor`/setup diagnostic path that can be run from the app and from the command line to explain missing Node/npm, Rust/Cargo, OpenSpec CLI, Codex CLI, GitHub CLI, runner binary, endpoint, and signing prerequisites.
- Add a macOS bootstrap path for source builds that installs or explains the minimum local toolchain needed to build Studio and the runner.
- Make runner process launch independent of shell dotfiles and Finder PATH quirks by constructing a deterministic child environment for managed runners.
- Require Studio to detect runner binary availability, version, protocol compatibility, endpoint reachability, health, and event stream support.
- Require auth diagnostics for Codex and GitHub CLI before dispatch.
- Require repository readiness diagnostics for OpenSpec presence, selected-change existence, GitHub remote, default branch/fetchability, publication readiness, and safe workspace root.
- Require setup smoke tests that exercise runner health, unsigned rejection, and signed request validation without launching an autonomous agent run.
- Fix local packaging/release ergonomics so a successful app build is not hidden behind brittle DMG packaging failures.
- Add setup states and recovery states that explain what the user can do next.
- Keep advanced custom runner mode for development and debugging.
- Keep signing, local-only dispatch, worktree isolation, event streaming, and publication rules intact.

## Out of scope
- Replacing Symphony as the runner implementation.
- Shipping a cloud runner.
- Silently installing Codex, GitHub CLI, OpenSpec CLI, or GitHub credentials without user action.
- Removing the advanced local runner path used by development builds.
- Weakening signed dispatch, localhost-only endpoint restrictions, workspace isolation, publication rules, or event streaming.
- Making the runner always-hot forever; the sidecar may stay running, but each agent execution remains a per-run session.
- Requiring Studio to silently mutate global shell profile files or install credentials.

## Impacted specs
- `local-desktop-shell`: one-install setup journey, managed sidecar lifecycle, compatibility checks, auth/repo diagnostics, recovery, and user-facing onboarding.
- `studio-runner-session`: setup/readiness state, runner version/compatibility metadata, managed/custom mode, diagnostics, and safe recovery semantics.
