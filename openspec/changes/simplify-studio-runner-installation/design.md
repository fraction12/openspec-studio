# Design: Studio Runner managed setup

## Product boundary
Studio Runner should be the product surface. Symphony is an implementation detail.

A new user should not need to know:

- which repo contains the runner implementation;
- that the runner is Elixir/OTP;
- how to run `mix escript.build`;
- which `WORKFLOW.md` fields are required;
- why HMAC signing headers exist;
- where worktrees are created;
- how Codex app-server is launched.

The normal flow should be:

1. Install/open OpenSpec Studio.
2. Open an OpenSpec repository.
3. Open the Runner tab.
4. Click **Set up Studio Runner** or **Enable Studio Runner**.
5. Studio verifies prerequisites and starts the managed runner.
6. Select an eligible change and click **Build with agent**.

## Setup modes

### Managed mode
Managed mode is the default user path.

Studio owns:

- locating the bundled/downloaded Studio Runner binary;
- checking runner version and compatibility;
- starting/stopping the runner;
- providing the session signing secret;
- checking `/health` and event stream reachability;
- surfacing diagnostics in plain product language.

The runner may still be the Symphony binary internally, but labels should say **Studio Runner**.

### Advanced custom runner mode
Advanced users/developers may provide a custom local runner binary/path or endpoint.

This mode is useful for:

- working from a local Symphony checkout;
- testing unreleased runner changes;
- debugging runner internals.

When custom mode is active, Studio should make that explicit and warn that compatibility is user-managed. It should still run the same health/version/auth/repo diagnostics when possible.

## Setup checklist
The setup flow should show readiness as a checklist with action-oriented rows.

Required checks before dispatch:

- Studio Runner binary is present or installable.
- Runner version is compatible with this Studio version.
- Runner endpoint is localhost-only and reachable after start.
- Runner health reports signed dispatch support.
- Runner event stream is reachable or clearly unavailable.
- Codex is installed and authenticated in a usable mode.
- GitHub CLI is installed and authenticated.
- The selected repository is a Git repository with a GitHub remote.
- The repository default branch is fetchable.
- OpenSpec change artifacts exist and validate.
- Runner workspace root exists or can be created safely.

Optional/advisory checks:

- Codex model/default settings are visible.
- GitHub remote is writable by the current auth user.
- Recent runner binary is not stale compared with Studio's expected runner protocol.

## Diagnostics language
Diagnostics should describe the user action, not the internal stack.

Good:

- “Studio Runner is not installed.”
- “Codex is logged in with an API key that is currently quota-limited. Re-authenticate Codex before running agents.”
- “GitHub CLI is not authenticated, so the agent cannot open a pull request.”
- “This repository's origin remote is local-only. Add a GitHub remote before using Build with agent.”

Avoid as primary copy:

- “Symphony escript missing.”
- “WORKFLOW.md invalid.”
- “HMAC secret not configured.”
- “Phoenix route unavailable.”

Those details may appear in expandable technical details.

## Runner version contract
The runner health response should expose enough metadata for Studio to decide compatibility, such as:

- runner name/product identity;
- runner version;
- protocol version;
- supported capabilities, including signed dispatch, event stream, worktree execution, and publication metadata;
- whether a signing secret is configured;
- current accepting/ready state.

Studio should refuse to dispatch when the runner protocol is incompatible, and should offer update/rebuild guidance instead of letting users discover stale-binary failures later.

## Auth diagnostics
The setup flow should distinguish:

- Codex missing;
- Codex not logged in;
- Codex logged in but quota/rate-limited;
- Codex using API-key auth when subscription auth is expected;
- GitHub CLI missing;
- GitHub CLI not logged in;
- GitHub CLI logged in but lacking repo permission.

Studio does not need to own credential setup, but it should tell the user exactly what is blocking agent execution.

## Repository diagnostics
Before enabling **Build with agent**, Studio should confirm:

- the open repository has an `openspec/` workspace;
- the selected change exists in the current repository state;
- required OpenSpec artifacts exist;
- validation status is available and acceptable;
- the repo has a non-local GitHub remote for publication;
- the base/default branch can be fetched;
- the runner can create an isolated worktree under its configured workspace root.

## Installation/update UX
The Runner tab should show setup as a small number of states:

- **Not set up**: explain what Studio Runner enables and provide setup action.
- **Checking**: running prerequisite checks.
- **Needs attention**: show blocking checklist rows with fix guidance.
- **Ready**: runner can start and receive work.
- **Running**: runner is online and event stream is connected when available.
- **Incompatible/stale**: runner exists but does not match Studio's expected protocol.

The user should not have to leave Studio to understand which state they are in.
