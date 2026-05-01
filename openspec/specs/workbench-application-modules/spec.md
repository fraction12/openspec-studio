# workbench-application-modules Specification

## Purpose
TBD - created by archiving change deepen-workbench-application-modules. Update Purpose after archive.
## Requirements
### Requirement: Repository Opening Flow Module owns repository transition policy
The system SHALL provide a Repository Opening Flow Module that concentrates app-shell repository transition policy without owning provider IO.

#### Scenario: Browser preview transition is derived
- **WHEN** the app is not running in the Tauri desktop runtime and a repository open is requested
- **THEN** the Repository Opening Flow Module SHALL derive the browser preview repository, empty Workspace View-Model, unavailable Git status, initial selection, load state, and user-facing message
- **AND** React callers SHALL NOT need to know the preview workspace construction details.

#### Scenario: No-provider transition is derived
- **WHEN** Provider Session reports that a selected folder has no matching Spec Provider
- **THEN** the Repository Opening Flow Module SHALL derive the candidate error, repository placeholder, workspace clearing behavior, selection clearing behavior, load state, and message
- **AND** it SHALL preserve the current active workspace when the current workspace should remain visible.

#### Scenario: Ready repository transition is derived
- **WHEN** Provider Session returns a ready repository and Workspace View-Model
- **THEN** the Repository Opening Flow Module SHALL derive whether to keep the existing selection or restore persisted selection
- **AND** it SHALL derive recent repository persistence, Git status refresh intent, load state, and refreshed-files message without performing provider IO.

#### Scenario: Refresh transition is derived
- **WHEN** Provider Session reports unchanged, updated, or stale repository refresh results
- **THEN** the Repository Opening Flow Module SHALL derive the workspace update, selection retention, Git status refresh intent, and user-facing message for that result.

### Requirement: Workspace Navigation State Module owns selection invariants
The system SHALL provide a Workspace Navigation State Module that derives workspace navigation state from the Workspace View-Model and persisted selection hints.

#### Scenario: New workspace navigation is initialized
- **WHEN** a different repository workspace is loaded
- **THEN** the Workspace Navigation State Module SHALL restore persisted selected change and spec IDs when they exist in the new workspace
- **AND** it SHALL fall back to the first active change, then first available change, then empty selection
- **AND** it SHALL reset board view, phase, detail tab, and workspace queries consistently with current behavior.

#### Scenario: Existing workspace navigation is retained
- **WHEN** the active workspace refreshes for the same repository
- **THEN** the Workspace Navigation State Module SHALL keep selected change and spec IDs that still exist
- **AND** it SHALL fall back to valid visible records when previous selections no longer exist.

#### Scenario: Detail tab remains valid
- **WHEN** the selected change or requested detail tab changes
- **THEN** the Workspace Navigation State Module SHALL return a detail tab that is valid for the selected change phase and available artifacts.

#### Scenario: Persisted selection payload is derived
- **WHEN** the selected change or selected spec changes for a persistable repository
- **THEN** the Workspace Navigation State Module SHALL derive the selection payload used by local app persistence without requiring persistence code to inspect React state.

### Requirement: Board Table Interaction Module owns reusable table policy
The system SHALL provide a Board Table Interaction Module that concentrates table interaction policy shared by Changes, Specs, and Runner Log tables.

#### Scenario: Sort state is derived
- **WHEN** table columns and a current sort state are provided
- **THEN** the Board Table Interaction Module SHALL derive the default sort state, next sort state, aria sort value, and sort button label consistently with existing table behavior.

#### Scenario: Sorted and bounded rows are derived
- **WHEN** rows, sortable column definitions, selected row ID, and row limit are provided
- **THEN** the Board Table Interaction Module SHALL return sorted rows and bounded visible rows
- **AND** the selected row SHALL remain included when it is outside the normal bounded window.

#### Scenario: Keyboard focus movement is derived
- **WHEN** a current focused row ID and a movement command are provided
- **THEN** the Board Table Interaction Module SHALL derive the next focused row ID without requiring callers to duplicate row-index logic.

#### Scenario: Resize width is constrained
- **WHEN** a table resize command produces a candidate width
- **THEN** the Board Table Interaction Module SHALL clamp the width to configured minimum and maximum values
- **AND** it SHALL derive reset width behavior consistently with existing table behavior.

### Requirement: Artifact Detail View-Model Module owns selected change detail modeling
The system SHALL provide an Artifact Detail View-Model Module that derives selected change detail state from a ChangeRecord, artifact preview content, validation state, and operation issues.

#### Scenario: Selected artifact detail is derived
- **WHEN** a selected change and requested detail tab are provided
- **THEN** the Artifact Detail View-Model Module SHALL normalize the selected tab, derive the artifact path for artifact-backed tabs, select relevant artifact-read issues, and provide tab-specific empty-state data.

#### Scenario: Task detail is derived
- **WHEN** the selected detail tab is tasks
- **THEN** the Artifact Detail View-Model Module SHALL parse task progress content into task items and open/done task groups compatible with existing inspector behavior.

#### Scenario: Archive detail is derived
- **WHEN** the selected change is archived
- **THEN** the Artifact Detail View-Model Module SHALL derive archive metadata, archived artifact display data, and archive-info tab state without requiring the React inspector to inspect archive internals directly.

#### Scenario: Validation and operation issue detail is derived
- **WHEN** validation state and operation issues are provided for a selected change
- **THEN** the Artifact Detail View-Model Module SHALL derive the relevant validation/status detail and OpenSpec issue display data for the inspector context.

### Requirement: Studio Runner Log Module owns runner history policy
The system SHALL provide a Studio Runner Log Module that concentrates Runner Log history policy around RunnerDispatchAttempt records.

#### Scenario: Runner log attempts are recorded
- **WHEN** a dispatch, lifecycle, status, or stream event is recorded
- **THEN** the Studio Runner Log Module SHALL create, replace, upsert, merge, sort, and cap Runner Log attempts consistently with existing persistence behavior.

#### Scenario: Stream events merge into existing attempts
- **WHEN** a runner stream event has the same event ID as an existing Runner Log attempt
- **THEN** the Studio Runner Log Module SHALL merge execution metadata into the existing attempt
- **AND** it SHALL NOT create a duplicate row for that event ID.

#### Scenario: Runner Log rows are derived
- **WHEN** Runner Log attempts exist for one or more repositories or changes
- **THEN** the Studio Runner Log Module SHALL derive repo-scoped history, change-scoped history, latest attempt, stable row identity, response/detail labels, status labels, and timestamps used by the Runner workspace.

#### Scenario: Persisted runner log records are normalized
- **WHEN** local app persistence loads runner dispatch attempts
- **THEN** the Studio Runner Log Module SHALL normalize only persistence-safe Runner Log records
- **AND** invalid records SHALL be dropped without changing the durable persistence schema.

### Requirement: Workbench Application Modules remain behavior-preserving
The Workbench Application Module extraction SHALL NOT change product behavior, visible workflows, persistence schema, native command names, OpenSpec provider behavior, or Studio Runner dispatch payload shape.

#### Scenario: Existing behavior remains stable
- **WHEN** the new Modules replace policy previously held in the app shell
- **THEN** existing tests for workspace projection, persistence, provider session, runner session, app model policy, validation results, and board sorting SHALL continue to pass
- **AND** new Module tests SHALL cover the moved policy at the new Interfaces.

#### Scenario: Module Interfaces pass the deletion test
- **WHEN** a new Module Interface is reviewed
- **THEN** deleting that Module SHOULD cause meaningful policy to spread back into multiple callers
- **AND** pass-through Modules that do not improve locality or leverage SHALL be folded into an existing Module instead.

