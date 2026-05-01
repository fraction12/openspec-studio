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
The system SHALL execute archive actions through a restricted desktop bridge command.

#### Scenario: User archives from the desktop app
- **WHEN** the user activates a change archive action
- **THEN** the bridge validates the selected repository and change name
- **AND** it invokes only the supported OpenSpec archive operation for that change

#### Scenario: Invalid archive input is supplied
- **WHEN** an archive request has an empty, path-like, or otherwise invalid change name
- **THEN** the bridge rejects the request
- **AND** no local files are moved by that request

#### Scenario: Archive completes
- **WHEN** OpenSpec archive succeeds for a change
- **THEN** the app refreshes local OpenSpec files
- **AND** the archived change appears through the app's derived archived-change data

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
The desktop shell SHALL provide Studio Runner as a first-class workspace-level surface, separate from selected change details, for local runner configuration, lifecycle, status, event streaming, and a repo-wide Runner Log.

#### Scenario: Runner event stream connects after runner is online
- **GIVEN** a real OpenSpec repository is open
- **AND** Studio Runner endpoint is configured
- **AND** Studio Runner is online
- **WHEN** Studio enters or refreshes the Runner workspace
- **THEN** Studio SHALL connect to the runner's local SSE event stream
- **AND** Studio SHALL derive the stream endpoint from the configured push dispatch endpoint
- **AND** Studio SHALL apply the same localhost-only endpoint restrictions used for runner dispatch

#### Scenario: Runner stream updates the Runner Log
- **GIVEN** Studio has recorded a local runner log event
- **AND** the runner stream emits an event with the same event ID
- **WHEN** Studio receives the stream event
- **THEN** Studio SHALL merge the execution metadata into the existing Runner Log record
- **AND** Studio SHALL NOT create a duplicate row for the same event ID

#### Scenario: Runner workspace shows all Studio Runner events
- **GIVEN** Studio Runner dispatch, stream, lifecycle, status, or error events exist for the current repository
- **WHEN** the user views the Runner workspace
- **THEN** Studio SHALL show them in a table titled **Runner Log**
- **AND** Studio SHALL NOT title the table **Build requests**
- **AND** Studio SHALL use subtext that describes runner events rather than only signed dispatches

#### Scenario: Runner workspace shows publication metadata
- **GIVEN** runner stream events include execution metadata
- **WHEN** the user views the Runner Log
- **THEN** Studio SHALL show runner execution status such as running, completed, blocked, or failed
- **AND** Studio SHALL show PR URL, commit SHA, branch name, workspace path, session ID, and bounded error detail when available

#### Scenario: Runner stream lifecycle follows local runner lifecycle
- **GIVEN** Studio starts, stops, restarts, or changes the configured runner endpoint
- **WHEN** runner availability or endpoint state changes
- **THEN** Studio SHALL start, stop, or reconnect the runner event stream accordingly
- **AND** Studio SHALL expose bounded stream error or disconnected state without blocking the app

#### Scenario: Runner inspector stays action focused
- **WHEN** the user views the Runner workspace inspector
- **THEN** the inspector SHALL show runner lifecycle, endpoint, session secret, and event stream controls
- **AND** the inspector SHALL NOT show a `Repo runner` pill, runner availability pill, repository metadata list, or managed-by-Studio metadata list

### Requirement: Signed Studio Runner dispatch
The desktop shell SHALL send Studio Runner dispatch requests with stable event identity, timestamped signatures, and at-least-once-safe semantics.

#### Scenario: Dispatch uses push API instead of tracker polling
- **GIVEN** Studio Runner is configured
- **WHEN** Studio sends `build.requested`
- **THEN** Studio SHALL use the runner's push dispatch API
- **AND** Studio SHALL NOT require Linear configuration, tracker polling, or OpenSpec-as-tracker-adapter behavior for the OpenSpec dispatch path

#### Scenario: Dispatch request includes verification headers
- **GIVEN** Studio dispatches a `build.requested` event
- **WHEN** the outbound request is created
- **THEN** the request SHALL include a stable webhook event ID
- **AND** the request SHALL include a timestamp header
- **AND** the request SHALL include an HMAC-SHA256 signature header over the event ID, timestamp, and raw request body

#### Scenario: Payload is thin and change-scoped
- **GIVEN** Studio dispatches a `build.requested` event
- **WHEN** the payload is constructed
- **THEN** the payload SHALL identify exactly one repository/change pair
- **AND** the payload SHALL include validation state and relevant artifact paths
- **AND** the payload SHALL NOT include arbitrary repository file contents by default

#### Scenario: Duplicate delivery is safe
- **GIVEN** Studio retries a failed delivery
- **WHEN** the retry request is created
- **THEN** Studio SHALL preserve the original event identity for that delivery record
- **AND** the receiver SHALL be able to deduplicate the retry using the event ID

#### Scenario: Delivery is bounded
- **GIVEN** Studio sends a Studio Runner dispatch request
- **WHEN** the endpoint is slow, unavailable, or returns a large response
- **THEN** Studio SHALL apply a bounded timeout and bounded response/error capture
- **AND** Studio SHALL record a failed delivery state instead of blocking the app indefinitely

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

