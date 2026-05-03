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

#### Scenario: Setup states are explicit
- **GIVEN** Studio Runner setup is not fully ready
- **WHEN** the Runner workspace renders
- **THEN** Studio SHALL show one of the high-level setup states: not set up, checking, needs attention, ready, running, incompatible/stale, or custom/user-managed
- **AND** each blocking state SHALL explain the next user action rather than exposing only raw command output.
