## ADDED Requirements

### Requirement: Provider contract is deterministic
The system SHALL define a deterministic spec provider contract for repository detection, workspace indexing, artifact reads, validation, archive actions, change status, Git status, and capability reporting.

#### Scenario: Provider contract is defined
- **WHEN** a provider is implemented
- **THEN** it declares a stable provider id, provider label, detection behavior, supported capabilities, and supported write actions
- **AND** it exposes deterministic operations instead of prompt-driven or generated runtime behavior.

#### Scenario: Provider operation receives bounded context
- **WHEN** a provider operation runs
- **THEN** it receives the selected repository context and operation-specific inputs
- **AND** it does not infer additional filesystem roots or command shapes from arbitrary repository content.

### Requirement: OpenSpec provider is the only built-in provider for this change
The system SHALL ship one built-in provider named `openspec` that preserves current OpenSpec Studio behavior.

#### Scenario: OpenSpec provider detects a repository
- **WHEN** a selected repository contains a real `openspec/` directory under the selected repository root
- **THEN** the `openspec` provider matches that repository
- **AND** the active provider identity is recorded as `openspec`.

#### Scenario: Repository does not contain OpenSpec
- **WHEN** a selected repository does not contain an `openspec/` directory
- **THEN** no provider is activated for that repository
- **AND** OpenSpec validation, archive, artifact read, status, and Git status actions are not offered as supported provider actions.

### Requirement: Provider capabilities govern UI actions
The system SHALL enable provider-backed UI actions from declared provider capabilities rather than hard-coded OpenSpec assumptions in UI components.

#### Scenario: Provider supports validation
- **WHEN** the active provider declares validation support
- **THEN** the app may show the provider validation action
- **AND** activating it invokes the active provider's validation operation.

#### Scenario: Provider does not support an action
- **WHEN** the active provider lacks validation, archive, artifact read, change status, or Git status support
- **THEN** the corresponding UI action is hidden, disabled, or represented as unsupported
- **AND** the app does not guess a command or filesystem operation for that action.

### Requirement: Provider workspace model preserves source-backed data
The system SHALL represent provider-indexed repository data as source-backed workspace state with provider identity, capabilities, work items, specs, artifacts, diagnostics, validation, source paths, and modified timestamps.

#### Scenario: OpenSpec provider indexes workspace files
- **WHEN** the OpenSpec provider indexes a repository
- **THEN** active changes, archived changes, specs, artifact paths, source content, task progress, touched capabilities, modified times, file signatures, and diagnostics are derived from the selected repository's real `openspec/` tree and OpenSpec command output
- **AND** the workspace carries the active provider id, label, and capabilities.

#### Scenario: Workspace is rebuilt through provider boundary
- **WHEN** the same OpenSpec file records and status records are indexed through the provider boundary
- **THEN** the resulting workspace data is equivalent to the current direct OpenSpec indexing output
- **AND** no fake, hard-coded, or browser-preview OpenSpec records are mixed into the provider-backed workspace.

### Requirement: Provider actions preserve local safety boundaries
Provider-backed actions SHALL preserve the existing Tauri bridge restrictions for paths, command shapes, command output, command timeouts, and write operations.

#### Scenario: OpenSpec validation runs
- **WHEN** the OpenSpec provider runs validation
- **THEN** it invokes only the supported `openspec validate --all --json` command shape through the restricted bridge
- **AND** command output and parse failures are surfaced as provider diagnostics.

#### Scenario: OpenSpec change status runs
- **WHEN** the OpenSpec provider loads status for a change
- **THEN** it invokes only the supported `openspec status --change <change> --json` command shape through the restricted bridge
- **AND** the change name is validated by the bridge before any command is spawned.

#### Scenario: OpenSpec archive runs
- **WHEN** the OpenSpec provider archives a change
- **THEN** it invokes only the dedicated archive bridge operation for a validated change name
- **AND** arbitrary provider-supplied shell commands are not executed.

#### Scenario: Artifact content is read
- **WHEN** the OpenSpec provider reads artifact content
- **THEN** the bridge verifies the artifact path resolves under the selected repository's `openspec/` directory
- **AND** reads outside that boundary are rejected.

### Requirement: Provider diagnostics are inspectable
The system SHALL route provider operation failures into inspectable operation diagnostics without silently losing repository state.

#### Scenario: Provider operation fails
- **WHEN** provider-backed repository read, status, artifact read, validation, archive, or Git status work fails
- **THEN** the app records the provider operation type, provider id when known, repository path, target when known, user-facing message, timestamp, and available stdout, stderr, or status code
- **AND** the active repository remains refreshable when the failure does not invalidate repository selection.

#### Scenario: Provider operation succeeds after failure
- **WHEN** a provider-backed operation succeeds after an earlier failure for the same repository and target
- **THEN** the stale operation diagnostic for that operation is cleared or superseded
- **AND** unrelated diagnostics remain visible.

### Requirement: Provider extraction preserves stale-result guards
Provider-backed asynchronous work SHALL preserve the current behavior that prevents stale completions from overwriting newer app state.

#### Scenario: Repository changes during provider work
- **WHEN** a provider-backed repository load, refresh, artifact read, validation, archive, or Git status request completes after the user has selected a different repository or a newer request has started
- **THEN** the app ignores the stale completion
- **AND** newer repository, workspace, selection, artifact preview, validation, archive, and Git state are not overwritten.

### Requirement: Adapter Foundry remains out of scope
The provider architecture SHALL leave room for future Adapter Foundry work without adding custom adapter authoring in this change.

#### Scenario: User runs this version
- **WHEN** the provider adapter change is implemented
- **THEN** users can operate the built-in OpenSpec provider only
- **AND** there is no UI or runtime path for generating, editing, installing, or executing custom adapters.

#### Scenario: Future adapter is considered
- **WHEN** a future change introduces adapter authoring or Adapter Foundry behavior
- **THEN** that adapter must satisfy the deterministic provider contract and declared capability model defined by this change
- **AND** any new command or filesystem capability must be explicitly bounded before product UI can invoke it.
