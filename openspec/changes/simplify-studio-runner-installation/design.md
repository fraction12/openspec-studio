# Design: One-install Studio Runner setup

## Intent brief

**Proposed solution:** Make Studio Runner work after installing OpenSpec Studio, without requiring users to manually clone and build Symphony.

**User/job:** A developer or product-builder wants to open an OpenSpec repo and ask an agent to implement a change locally.

**Current situation:** The execution path requires understanding and operating a separate Symphony repo/binary plus Codex/GitHub auth and local runner details.

**Pain/opportunity:** The lab setup creates friction, support burden, stale-binary failures, and confusion about what product the user is actually using.

**Desired outcome:** The normal user experiences Studio Runner as part of OpenSpec Studio: one app, one setup flow, one clear Runner surface.

**Success signal:** A new user can install Studio, open a repo, complete setup, and dispatch a change without cloning Symphony or reading runner-internal docs.

## Product boundary
Studio Runner is the product. Symphony is the engine.

A new user should not need to know:

- which repo contains the runner implementation;
- that the runner is Elixir/OTP;
- how to run `mix escript.build`;
- which `WORKFLOW.md` fields are required;
- why HMAC signing headers exist;
- where worktrees are created;
- how Codex app-server is launched.

Those details can exist in expandable technical details and developer docs, but not as the primary setup path.

## Recommended direction
Choose **managed sidecar with advanced custom override**.

### Why this is the right v1
- It preserves the local-first trust model.
- It avoids a cloud service and account system.
- It makes the install story product-grade without forcing a full rewrite of Symphony.
- It keeps developer velocity: custom runner mode still supports local Symphony hacking.
- It gives Studio one place to handle version compatibility, stale binaries, auth checks, and recovery.

### Alternatives rejected

#### Require users to clone Symphony
Rejected. This is the current lab setup and fails the product promise.

#### Merge all Symphony code into Studio immediately
Rejected for v1. It is likely too disruptive and risks destabilizing the already-working runner/orchestrator path.

#### Ship a cloud runner
Rejected. It changes the trust/security model, adds backend operations, and conflicts with the local-first positioning.

#### Hide everything but keep manual docs
Rejected. Better docs help, but they do not remove the two-repo setup burden.

## Target user journey

### First-run / not set up
1. User opens Runner workspace.
2. Studio explains: “Studio Runner lets agents implement OpenSpec changes locally and open PRs.”
3. Primary action: **Set up Studio Runner**.
4. Secondary action: **Use custom runner**.

### Setup check
Studio runs a checklist:

- managed runner sidecar present or installable;
- runner protocol compatible with Studio;
- localhost endpoint available;
- runner health supports signed dispatch;
- event stream available or clearly unavailable;
- Codex installed/authenticated/usable;
- GitHub CLI installed/authenticated/authorized;
- selected repo has OpenSpec files;
- selected change exists and validates;
- repo has GitHub-capable remote;
- base branch fetches;
- workspace root can be created safely.

### Ready/running
- If checks pass, Studio starts the sidecar or confirms it is ready.
- The Runner workspace shows status, stream state, session secret state, and Runner Log.
- Change inspector enables **Build with agent** only when setup and change eligibility pass.

### Needs attention
- Blockers are shown as product language first, technical detail second.
- Example: “GitHub CLI is not authenticated, so the agent cannot open a pull request.”
- Action should be explicit: open docs, rerun check, switch to custom runner, restart sidecar, update runner.

### Custom runner
- User can point at a localhost endpoint or local binary/path.
- UI labels it as “Custom runner — updates and compatibility are user-managed.”
- Studio still performs health, protocol, auth, repo, and event stream checks when possible.

## Packaging and update model
The spec should allow either bundled or downloadable sidecar packaging, but it must not leave normal users with “clone Symphony” as the required path.

Acceptable managed-runner strategies:

1. **Bundled sidecar:** Studio installer includes the compatible runner binary.
2. **First-run download:** Studio downloads a signed/versioned runner asset on demand.
3. **Managed local install:** Studio installs the runner into app-controlled support data and updates it when protocols change.

The implementation may choose one strategy, but the product contract is the same: Studio owns it, verifies it, and explains failures.

## Version and compatibility contract
Runner health should expose enough metadata for Studio to make deterministic decisions:

- product/name identity, e.g. `studio-runner`;
- implementation identity, optionally `symphony` for technical details;
- runner version/build SHA;
- protocol version;
- supported capabilities: signed dispatch, event stream, worktree execution, publication metadata, execution defaults, execution logs if available;
- signing-secret configured status;
- accepting dispatch status;
- compatibility range or minimum Studio protocol.

Studio must refuse dispatch when the runner protocol is incompatible and offer update/reinstall/restart guidance.

## Auth diagnostics
Studio should diagnose, not own, credentials.

Required categories:

- Codex missing;
- Codex not logged in;
- Codex logged in but quota/rate-limited;
- Codex using API-key auth when subscription auth is expected or recommended;
- GitHub CLI missing;
- GitHub CLI not logged in;
- GitHub CLI logged in but lacking repo permission;
- remote appears local-only or non-GitHub, so PR publication will fail.

Diagnostics must redact secrets and avoid storing tokens, signatures, auth headers, or raw environment values.

## Repository diagnostics
Before enabling **Build with agent**, Studio should confirm:

- an OpenSpec workspace is present;
- selected change exists in the current repo state;
- required artifacts exist;
- validation state is available and acceptable;
- Git repository status is readable;
- origin or selected publication remote is GitHub-capable;
- base/default branch can be fetched;
- runner workspace root exists or can be created safely;
- stale local runner state has been reconciled enough not to lock the UI incorrectly.

## UI states
The Runner tab should present setup as a small number of states:

- **Not set up**: explain value and provide setup action.
- **Checking**: running prerequisite checks.
- **Needs attention**: blocking checklist rows with fix guidance.
- **Ready**: runner can start and receive work.
- **Running**: runner is online and event stream is connected when available.
- **Incompatible/stale**: runner exists but does not match Studio's expected protocol.
- **Custom/user-managed**: custom mode active; compatibility is still checked but updates are the user's responsibility.

## Copy principles
Primary copy should say:

- “Studio Runner is not installed.”
- “Update Studio Runner.”
- “Codex is not ready.”
- “GitHub CLI cannot open pull requests for this repo.”
- “This repository needs a GitHub remote before agents can publish work.”

Primary copy should not say:

- “Symphony escript missing.”
- “WORKFLOW.md invalid.”
- “HMAC secret not configured.”
- “Phoenix route unavailable.”

Those can appear in technical details.

## Engineering fit
Relevant existing surfaces:

- `src/runner/studioRunnerSession.ts` owns frontend runner operations.
- `src/runner/studioRunnerLog.ts` owns runner history/log policy.
- `src-tauri/src/bridge/studio_runner.rs` owns native runner lifecycle, endpoint checks, signing, stream, and dispatch behavior.
- `openspec/specs/local-desktop-shell/spec.md` already treats Runner as a first-class workspace.
- `openspec/specs/studio-runner-session/spec.md` already defines bounded session/log behavior.

Recommended implementation approach:

1. Add runner setup/readiness model in the Studio Runner Session module.
2. Extend Tauri runner bridge with managed sidecar discovery/install/update/check commands.
3. Extend runner health parsing for identity/protocol/capabilities.
4. Add auth/repo/workspace diagnostic commands with redacted results.
5. Build Runner tab setup UI as checklist/state machine.
6. Gate dispatch on setup readiness plus existing per-change eligibility.
7. Keep custom runner endpoint/path mode as an explicit advanced state.

## Risks and mitigations

- **Packaging complexity:** Start with one supported OS/package path if needed, but preserve the product contract and mark unsupported platforms clearly.
- **Security:** Managed downloads must be signed or checksum-verified; endpoints remain localhost-only; secrets remain session-scoped.
- **Stale runner binaries:** Protocol/version compatibility check blocks dispatch and offers update.
- **Credential confusion:** Diagnostics should separate Codex, GitHub, and repo-publication problems.
- **Advanced users:** Custom mode must remain possible, but it should not define the default experience.
