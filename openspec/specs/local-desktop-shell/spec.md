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

#### Scenario: Global actions are displayed
- **WHEN** the workspace is loaded
- **THEN** repository opening, file refresh, validation, and file-opening actions use consistent button sizes and visual states
- **AND** labels distinguish opening a repository, refreshing indexed files, running validation, opening files, revealing files, and retrying failed actions

#### Scenario: Long-running work is in progress
- **WHEN** the app is indexing files, refreshing files, running validation, reading artifact content, or running OpenSpec/Git commands
- **THEN** affected actions show loading or disabled states without shifting layout
- **AND** background refresh work does not unnecessarily flash global loading state
- **AND** the user can still identify the active repository and current trust state

#### Scenario: Background work completes after newer work
- **WHEN** an older load, refresh, artifact-read, validation, archive, or Git-status request completes after a newer request for the same view has started
- **THEN** the app ignores the stale completion
- **AND** it does not overwrite newer repository, workspace, selection, preview, validation, or Git state

#### Scenario: Detail panels scroll
- **WHEN** inspector content is longer than the available panel height
- **THEN** scrolling preserves readable gutters and stable scrollbar spacing
- **AND** the bottom status band does not obscure or visually compete with the detail content
- **AND** nested artifact preview regions do not trap normal vertical reading when the panel itself can scroll

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
