# local-desktop-shell Specification

## Purpose
Define the local-first packaged desktop shell, native repository selection, restricted bridge operations, and recovery behavior that let OpenSpec Studio inspect and safely mutate local OpenSpec repositories.
## Requirements
### Requirement: Standalone local desktop application
The system SHALL run as a standalone local desktop application without requiring the user to start a development server.

#### Scenario: User launches the app normally
- **WHEN** the user opens OpenSpec Studio from the operating system
- **THEN** the app starts without requiring `npm run dev` or a browser-served web app
- **AND** the app can operate against local repositories on the same machine

#### Scenario: App remains local-first
- **WHEN** the app indexes or displays OpenSpec data
- **THEN** it reads from local repositories and local CLI output
- **AND** it does not require an account, cloud service, or remote database

#### Scenario: Packaged app finds the installed OpenSpec CLI
- **WHEN** the app is launched from the operating system with a limited desktop environment PATH
- **THEN** the local bridge can still run the installed `openspec` CLI from standard local install locations
- **AND** generic command arguments remain restricted to product-supported OpenSpec read and validation command shapes
- **AND** dedicated write commands, such as archive, are exposed only through separate bridge operations that validate their own inputs

### Requirement: Repository selection
The system SHALL allow the user to select a local repository to inspect.

#### Scenario: User selects a valid OpenSpec repo
- **WHEN** the user selects a folder containing an `openspec/` directory
- **THEN** the app accepts the folder as the active repository
- **AND** it begins indexing the OpenSpec workspace

#### Scenario: User selects a folder without OpenSpec
- **WHEN** the user selects a folder that does not contain an `openspec/` directory
- **THEN** the app reports that no OpenSpec workspace was found
- **AND** it does not create or modify project files without explicit user action

### Requirement: Recent repository access
The system SHALL remember recently opened repositories as app-local convenience state.

#### Scenario: User reopens a recent repo
- **WHEN** the user launches the app after previously opening repositories
- **THEN** the app shows recent repository paths
- **AND** selecting one reopens that repo if it still exists

### Requirement: Native desktop repository opening
The system SHALL make native folder selection the primary way to open a local OpenSpec repository in the desktop app.

#### Scenario: User chooses a repository folder
- **WHEN** the user activates the primary repository-open action
- **THEN** the app opens a native folder selection dialog
- **AND** selecting a folder begins repository validation and indexing for that folder

#### Scenario: User prefers manual path entry
- **WHEN** the user needs to paste or type a repository path
- **THEN** the app provides manual path entry as a secondary or advanced control
- **AND** manual entry follows the same validation, indexing, and recovery behavior as folder selection

#### Scenario: User cancels folder selection
- **WHEN** the folder selection dialog is canceled
- **THEN** the active repository and workspace remain unchanged
- **AND** the app does not show an error state

### Requirement: Desktop shell provides clear global chrome
The system SHALL present global navigation, action, and status chrome with consistent control sizing, hierarchy, spacing, and recovery affordances.

#### Scenario: Workspace header shows runner status
- **WHEN** a repository workspace is loaded
- **THEN** the workspace header SHALL show a compact Studio Runner status pill beside the Changes, Specs, and Runner view selector
- **AND** the status pill SHALL use `Online` when the runner is available and `Offline` when the runner is unavailable
- **AND** the status pill SHALL remain compact and SHALL NOT duplicate runner setup, lifecycle, or history controls
- **AND** the header SHALL NOT show workbench/local eyebrow copy or the active repository filesystem path

### Requirement: First-run and launch recovery are actionable
The system SHALL guide users to a useful repository selection state on launch without relying on a hardcoded development path.

#### Scenario: Last repository can be restored
- **WHEN** the user launches the app after successfully opening a repository
- **THEN** the app restores the last successful repository when it still exists
- **AND** it indexes that repository without requiring the user to re-enter its path

#### Scenario: No repository can be restored
- **WHEN** the app has no successful repository history or the last repository is unavailable
- **THEN** the app shows a choose-folder empty state
- **AND** the empty state explains that OpenSpec Studio reads local repositories and does not create files during repository selection

### Requirement: Archive actions use a restricted desktop bridge
The system SHALL execute archive actions through a restricted desktop bridge command, and SHALL report archive success only after verifying the repository state changed as expected.

#### Scenario: User archives from the desktop app
- **WHEN** the user activates a change archive action
- **THEN** the bridge validates the selected repository and change name
- **AND** it invokes only the supported OpenSpec archive operation for that change
- **AND** Studio rebuilds the workspace state from local files before reporting success

#### Scenario: Invalid archive input is supplied
- **WHEN** an archive request has an empty, path-like, or otherwise invalid change name
- **THEN** the bridge rejects the request
- **AND** no local files are moved by that request

#### Scenario: Archive completes
- **WHEN** OpenSpec archive succeeds for a change and local repository state confirms the mutation
- **THEN** the app refreshes local OpenSpec files
- **AND** the archived change appears through the app's derived archived-change data
- **AND** the active change no longer appears in the active change list

#### Scenario: Archive command exits successfully without moving files
- **WHEN** OpenSpec archive exits successfully but reports that no files changed or the active change remains present after refresh
- **THEN** Studio SHALL NOT report the archive as successful
- **AND** Studio SHALL surface a postcondition failure with the available command output and missing state evidence

### Requirement: Desktop bridge keeps local operations bounded
The system SHALL keep local filesystem and process work responsive, bounded, and recoverable from the packaged desktop app.

#### Scenario: Bridge runs a supported local command
- **WHEN** the bridge runs OpenSpec, Git, or operating-system helper commands
- **THEN** the command executes with a bounded timeout
- **AND** captured output is bounded to prevent unbounded memory growth
- **AND** timeout or output-limit failures are surfaced as command diagnostics

#### Scenario: Bridge scans OpenSpec files
- **WHEN** the bridge scans a repository's `openspec/` directory
- **THEN** expensive filesystem traversal runs outside latency-sensitive command handling
- **AND** symlinked directories do not cause recursive loops
- **AND** read or metadata failures are reported with enough path context for the UI to explain the issue

#### Scenario: Refresh work overlaps
- **WHEN** a background repository refresh is already in flight for the active repository
- **THEN** the app does not start another overlapping background refresh for that repository
- **AND** a manual refresh or archive-triggered refresh can supersede the background request safely

### Requirement: Desktop Integration Audit Coverage
The audit SHALL inspect local desktop integration code for command execution, child process environment, path handling, filesystem boundaries, packaging behavior, and user-facing error propagation.

#### Scenario: Reviewer records desktop integration findings
- **WHEN** a reviewer identifies a desktop integration issue
- **THEN** they SHALL record the issue with severity, file references, reproduction notes, and a recommended fix.

### Requirement: Archive command failures are surfaced without losing repository state
The desktop archive flow SHALL surface OpenSpec archive failures from the command bridge and keep the repository refreshable.

#### Scenario: OpenSpec archive rejects a change delta
- **WHEN** OpenSpec archive fails before moving files
- **THEN** Studio SHALL report the command output to the user
- **AND** the active repository data SHALL remain refreshable.

### Requirement: Desktop folder selection is cross-platform
The packaged desktop app SHALL provide a native folder picker on supported Tauri desktop targets through a cross-platform dialog integration.

#### Scenario: User chooses a repository folder
- **WHEN** the user activates Choose folder from the desktop app
- **THEN** a native folder picker SHALL open
- **AND** cancellation SHALL be distinguishable from bridge failure.

### Requirement: Local command execution is bounded and narrow
The desktop bridge SHALL execute only product-supported OpenSpec command shapes through the generic command bridge, and dedicated write commands SHALL validate their own inputs.

#### Scenario: Unsupported OpenSpec arguments are rejected
- **WHEN** the frontend invokes a command shape outside Studio's supported list
- **THEN** the bridge SHALL reject it before spawning the CLI.

#### Scenario: Command timeout does not hang the bridge
- **WHEN** a local command times out or exceeds output limits
- **THEN** Studio SHALL return an error without indefinitely waiting on descendants that keep stdio open.

### Requirement: File and Git metadata preserve local reality
The desktop bridge SHALL represent symlink entries under `openspec/` without following them and SHALL preserve Git porcelain status records without stripping status columns.

#### Scenario: Broken symlink exists under openspec
- **WHEN** a broken symlink is present under `openspec/`
- **THEN** file listing SHALL continue
- **AND** the symlink record SHALL carry read/error metadata instead of aborting the repository index.

### Requirement: Packaged app uses a restrictive webview boundary
The packaged desktop app SHALL configure a restrictive Content Security Policy and SHALL expose only native commands used by the product.

#### Scenario: Packaged app loads local assets
- **WHEN** Studio runs as a packaged desktop app
- **THEN** scripts, styles, images, and fonts SHALL be limited to local app-safe sources
- **AND** unused native invoke commands SHALL NOT be registered.

### Requirement: OpenSpec operation failures are inspectable
The desktop app SHALL surface failed OpenSpec-backed operations as durable, inspectable UI state.

#### Scenario: OpenSpec command fails
- **WHEN** an OpenSpec CLI command invoked by the app exits unsuccessfully or cannot be parsed
- **THEN** the app records an operation issue containing the operation type, user-facing message, timestamp, and available status code, stdout, and stderr
- **AND** the issue remains visible after the transient status message changes.

#### Scenario: OpenSpec file read fails
- **WHEN** a selected OpenSpec artifact cannot be read
- **THEN** the app shows an error in the artifact preview context
- **AND** the app records an operation issue for the failed artifact path.

#### Scenario: User dismisses operation issues
- **WHEN** the user dismisses visible OpenSpec operation issues
- **THEN** the issues are removed from the visible issue surface without changing repository files.

### Requirement: Local Studio Runner workspace
The desktop shell SHALL provide Studio Runner as a first-class workspace-level surface, separate from selected change details, for local runner configuration, lifecycle, status, event streaming, execution-log inspection, setup diagnostics, and a repo-wide Runner Log.

#### Scenario: Existing local runner listener is recovered
- **GIVEN** the configured Studio Runner endpoint is localhost-only
- **AND** a local listener is already bound to that endpoint's port
- **WHEN** Studio checks Runner status or opens the Runner workspace
- **THEN** Studio SHALL inspect whether the listener matches the expected Studio Runner for the active repository
- **AND** when it matches, Studio SHALL show the runner as recovered or already running instead of offline
- **AND** Studio SHALL expose lifecycle controls appropriate to the recovered runner.

#### Scenario: Existing local runner listener is recovered after app restart
- **GIVEN** Studio previously started a local Studio Runner listener
- **AND** the Studio app has been closed and reopened so the in-memory session secret is no longer configured
- **WHEN** Studio checks Runner status for the configured localhost endpoint
- **THEN** Studio SHALL still inspect the endpoint and local listener process
- **AND** when the listener matches the expected Studio Runner for the active repository, Studio SHALL show a yellow "Restart runner" status instead of requiring Start runner first
- **AND** Studio SHALL explain in the Runner inspector that the existing local Studio Runner must be restarted to fix the session secret mismatch
- **AND** Studio SHALL keep Build with agent unavailable until the runner is restarted with the current app session secret.

#### Scenario: Custom user-managed runner is status-only
- **GIVEN** the configured Studio Runner endpoint reaches a compatible custom or user-managed runner
- **WHEN** Studio checks Runner status or opens the Runner workspace
- **THEN** Studio SHALL show the runner reachability and user-facing guidance
- **AND** Studio SHALL NOT expose Stop or Restart as process-termination actions for that custom/user-managed runner in this change.

#### Scenario: Non-matching process owns the runner port
- **GIVEN** the configured Studio Runner port is already occupied by a process that does not match the expected Studio Runner for the active repository or configured custom runner
- **WHEN** Studio checks Runner status or tries to start the runner
- **THEN** Studio SHALL report that the port is occupied by a non-matching process
- **AND** Studio SHALL NOT terminate that process automatically
- **AND** Studio SHALL guide the user to stop the process or choose another endpoint.

#### Scenario: Stop runner handles recovered matching listener
- **GIVEN** Studio has lost its in-memory child-process handle
- **AND** a matching Studio Runner listener is still running for the active repository
- **WHEN** the user activates Stop runner
- **THEN** Studio SHALL stop that matching listener using guarded process termination
- **AND** Studio SHALL update Runner status so the endpoint is no longer reported as running.

#### Scenario: Restart runner replaces stale matching listener
- **GIVEN** a matching Studio Runner listener is already bound to the configured port
- **WHEN** the user activates Restart runner
- **THEN** Studio SHALL stop the matching stale listener before starting a new managed runner with the current session secret
- **AND** Studio SHALL refuse to replace non-matching listeners.

### Requirement: Signed Studio Runner dispatch
The desktop shell SHALL send Studio Runner dispatch requests with stable event identity, timestamped signatures, and at-least-once-safe semantics.

#### Scenario: Selected change cannot dispatch duplicate in-flight work
- **GIVEN** Studio knows of an accepted or running Studio Runner event for the selected repository/change
- **WHEN** the user views that change's inspector
- **THEN** Studio SHALL disable the dispatch action for that selected change
- **AND** Studio SHALL NOT send another `build.requested` event for that same repository/change from the disabled button.

#### Scenario: Running detection ignores non-run rows
- **GIVEN** the Runner Log contains lifecycle, stream, status, or diagnostic rows
- **WHEN** Studio decides whether the selected change is building
- **THEN** Studio SHALL ignore those non-run rows
- **AND** Studio SHALL only consider actual run/dispatch rows for the same repository/change.

#### Scenario: Other changes remain governed by normal eligibility
- **GIVEN** one change has an accepted or running Studio Runner event
- **WHEN** the user selects a different active change
- **THEN** Studio SHALL evaluate that different change using the normal dispatch eligibility rules
- **AND** Studio SHALL NOT disable its Build action solely because another change is running.

### Requirement: Repository loading uses provider activation
The desktop shell SHALL activate a deterministic spec provider when opening a repository instead of hard-coding all workspace behavior directly into the shell.

#### Scenario: OpenSpec repo is selected
- **WHEN** the user opens a repository containing an `openspec/` directory under the selected repo root
- **THEN** the app activates the built-in OpenSpec provider
- **AND** the repository is shown as a ready workspace using provider-derived state.

#### Scenario: No provider matches
- **WHEN** the user opens a repository that no built-in provider detects
- **THEN** the app shows a no-workspace or unsupported-workspace state
- **AND** it does not create provider files automatically.

#### Scenario: Provider detection fails
- **WHEN** provider detection cannot read the selected folder or cannot validate repository shape
- **THEN** the app shows an actionable repository-unavailable state
- **AND** the previous ready workspace remains intact when one exists.

#### Scenario: Shell delegates provider workflow to session
- **WHEN** the desktop shell loads, refreshes, validates, archives, reads artifacts, or checks provider Git status
- **THEN** it performs the operation through the active provider session
- **AND** shell code does not duplicate provider-specific command shapes or workflow ordering.

### Requirement: Provider identity is visible to app state
The desktop shell SHALL carry the active provider identity in repository or workspace state.

#### Scenario: Provider-backed workspace loads
- **WHEN** a repository is successfully indexed by a provider
- **THEN** app state records the provider id and provider label
- **AND** diagnostics/actions can be attributed to that provider.

#### Scenario: Provider capabilities are recorded
- **WHEN** a provider-backed workspace loads
- **THEN** app state records the provider's artifact, validation, archive, status, and Git capabilities
- **AND** global actions use those capabilities to decide whether an operation is available.

### Requirement: Provider activation preserves desktop bridge safety
The desktop shell SHALL keep native command and filesystem execution behind the existing restricted Tauri bridge when provider architecture is introduced.

#### Scenario: OpenSpec provider invokes bridge commands
- **WHEN** the OpenSpec provider validates, reads files, reads artifacts, loads status, archives, or checks Git status
- **THEN** it uses the same narrow bridge operations already used by the app
- **AND** the provider layer does not introduce arbitrary command execution.

#### Scenario: Unsupported provider action is requested
- **WHEN** no active provider supports a requested operation
- **THEN** the shell rejects the operation before invoking the bridge
- **AND** the rejection is surfaced as a provider capability problem rather than a silent no-op.

### Requirement: Mutating operations verify postconditions
The desktop bridge and app shell SHALL verify explicit state postconditions for local operations that mutate repository files before presenting the operation as successful.

#### Scenario: Mutating command reports process success
- **WHEN** a supported mutating operation exits with a successful status code
- **THEN** Studio SHALL verify the operation-specific repository state change before showing success
- **AND** command success alone SHALL NOT be sufficient for user-facing success

#### Scenario: Mutating command is a no-op
- **WHEN** a mutating operation exits successfully but the expected repository state change is absent
- **THEN** Studio SHALL classify the operation as failed, no-op, or postcondition-failed rather than successful
- **AND** Studio SHALL keep the repository refreshable and avoid moving selection to nonexistent records

#### Scenario: Postcondition failure is diagnosed
- **WHEN** Studio detects a missing postcondition after a mutating operation
- **THEN** it SHALL record an operation issue with the operation type, target, timestamp, command status, stdout, stderr, and missing evidence when available

#### Scenario: Footer keeps operation diagnostics compact
- **WHEN** a mutating operation records an OpenSpec operation issue with detailed command output
- **THEN** the footer SHALL show the compact OpenSpec issue badge
- **AND** the footer SHALL NOT show the detailed failure message, stdout, stderr, or missing evidence as transient footer text
- **AND** the detailed diagnostic output SHALL remain available from the inspector or issue surface

