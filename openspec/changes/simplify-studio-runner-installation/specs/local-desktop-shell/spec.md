# local-desktop-shell Specification Delta

## MODIFIED Requirements
### Requirement: Local Studio Runner workspace
The desktop shell SHALL provide Studio Runner as a first-class workspace-level surface, separate from selected change details, for local runner setup, lifecycle, status, event streaming, execution-log inspection, setup diagnostics, and a repo-wide Runner Log.

#### Scenario: New user can enable Studio Runner without understanding Symphony internals
- **GIVEN** a user opens the Runner workspace without a configured runner
- **WHEN** Studio presents setup guidance
- **THEN** Studio SHALL describe the capability as **Studio Runner**
- **AND** Studio SHALL NOT require the user to clone, build, or configure a separate Symphony repository in the primary setup path
- **AND** Studio SHALL NOT require the user to understand Symphony, Elixir, escript builds, HMAC headers, or `WORKFLOW.md` internals in the primary setup path
- **AND** Studio SHALL provide a setup action or checklist that explains what remains before **Build with agent** can be used.

#### Scenario: Managed runner is the default setup path
- **GIVEN** Studio supports a managed Studio Runner binary or sidecar
- **WHEN** the user starts setup
- **THEN** Studio SHALL prefer the managed runner path over requiring a separate Symphony checkout
- **AND** Studio SHALL check that the managed runner binary exists or is installable
- **AND** Studio SHALL install, update, start, stop, and health-check the managed runner through Studio-owned controls where supported
- **AND** Studio SHALL label the experience as Studio Runner rather than Symphony in the primary UI.

#### Scenario: Runner path is configured at runtime
- **GIVEN** a source build or installed app does not include a managed runner
- **WHEN** Studio discovers or asks for a runner location
- **THEN** Studio SHALL persist the selected runner repository, runner binary, or custom endpoint in runtime app state
- **AND** Studio SHALL NOT depend on a developer-machine fallback path compiled into the frontend bundle
- **AND** Studio SHALL prefer runtime discovery over build-time environment variables such as `.env.local`.

#### Scenario: One-install product promise is preserved
- **GIVEN** a normal user installs OpenSpec Studio
- **WHEN** they open a valid local OpenSpec repository and choose to enable Runner
- **THEN** the primary flow SHALL keep them inside OpenSpec Studio for runner setup, readiness checks, start, and dispatch
- **AND** any required external actions, such as Codex or GitHub authentication, SHALL be presented as prerequisite fixes rather than separate-runner setup instructions.

#### Scenario: Advanced custom runner remains available
- **GIVEN** a developer wants to use a custom local runner binary, local Symphony checkout, or localhost endpoint
- **WHEN** they choose advanced runner configuration
- **THEN** Studio SHALL allow a custom local runner path or localhost endpoint
- **AND** Studio SHALL clearly mark compatibility and updates as user-managed
- **AND** Studio SHALL still apply localhost-only endpoint restrictions and signed dispatch requirements.

#### Scenario: Runner setup offers repair actions
- **GIVEN** Studio Runner setup has a missing, stale, unreachable, or incompatible runner
- **WHEN** Studio reports the problem
- **THEN** Studio SHALL offer applicable repair actions such as auto-detect runner, choose runner folder, choose runner binary, build or rebuild runner, test health, view logs, or configure custom endpoint
- **AND** Studio SHALL keep advanced details expandable rather than making them the primary setup path.

#### Scenario: Finder-launched app can start the runner
- **GIVEN** a user launches OpenSpec Studio from Finder or the Dock on macOS
- **WHEN** Studio starts or health-checks a local runner
- **THEN** Studio SHALL construct a deterministic child-process environment for required tools
- **AND** Studio SHALL NOT rely on interactive shell startup files such as `.zprofile`, `.zshrc`, or `mise activate`
- **AND** Studio SHALL detect and report missing `codex`, `escript`, Erlang, Elixir, Mix, or equivalent packaged runtime dependencies before dispatch.

#### Scenario: Runner compatibility is checked before dispatch
- **GIVEN** a runner is configured, discovered, installed, or started
- **WHEN** Studio checks runner readiness
- **THEN** Studio SHALL verify runner health, product identity, version or build identity, protocol compatibility, signed dispatch support, and event stream availability when supported
- **AND** Studio SHALL block dispatch with actionable guidance when the runner is missing, stale, incompatible, unreachable, or not accepting signed dispatches.

#### Scenario: Setup checklist reports auth readiness
- **GIVEN** the user is setting up Studio Runner
- **WHEN** Studio runs prerequisite checks
- **THEN** Studio SHALL report Codex installation/auth readiness
- **AND** Studio SHALL report GitHub CLI installation/auth readiness
- **AND** Studio SHALL distinguish missing tools, unauthenticated tools, quota/rate-limit/auth-mode blockers, and permission blockers when that evidence is available.

#### Scenario: Setup checklist reports repository readiness
- **GIVEN** a repository is open
- **WHEN** Studio evaluates whether agent execution can be enabled
- **THEN** Studio SHALL check for an OpenSpec workspace, selected change existence, required artifacts, validation state, Git repository status, GitHub-capable remote, fetchable base branch, publication readiness, and a safe runner workspace root
- **AND** Studio SHALL show blockers in user-facing language with technical details available on demand.

#### Scenario: Doctor validates setup without launching an agent
- **GIVEN** a user wants to confirm Studio Runner setup is healthy
- **WHEN** Studio runs a doctor or smoke-check workflow
- **THEN** Studio SHALL verify runner health, localhost endpoint reachability, signed-dispatch prerequisites, unsigned request rejection, malformed signed payload validation, and clean port cleanup without launching a real agent task
- **AND** Studio SHALL report each result as pass, warning, or blocker with non-sensitive technical details available on demand.

#### Scenario: Source-build bootstrap is actionable
- **GIVEN** a developer is running OpenSpec Studio from source
- **WHEN** Studio or a bootstrap script checks local prerequisites
- **THEN** it SHALL validate Node/npm, Rust/Cargo, OpenSpec CLI, Codex CLI, GitHub CLI, runner binary, runner endpoint conflicts, and signing prerequisites
- **AND** it SHALL provide copyable or executable repair steps without silently mutating shell profiles or installing credentials.

#### Scenario: Packaging failures do not hide app build success
- **GIVEN** a release build creates a macOS `.app` bundle but fails to create a DMG
- **WHEN** Studio reports build or packaging status
- **THEN** Studio SHALL distinguish application bundle success from installer image success
- **AND** Studio SHALL provide a deterministic fallback path for using or distributing the `.app` bundle.

#### Scenario: Setup states are explicit
- **GIVEN** Studio Runner setup is not fully ready
- **WHEN** the Runner workspace renders
- **THEN** Studio SHALL show one of the high-level setup states: not set up, checking, needs attention, ready, running, incompatible/stale, or custom/user-managed
- **AND** each blocking state SHALL explain the next user action rather than exposing only raw command output.
