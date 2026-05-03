## ADDED Requirements

### Requirement: Settings control existing app behavior
The settings surface SHALL expose controls only for behavior, persisted data, or integrations that the app already implements or that are delivered by an accepted active capability change.

#### Scenario: Settings are rendered
- **WHEN** the user opens Settings
- **THEN** each visible setting maps to current app behavior, current app-local state, or an implemented capability
- **AND** Settings SHALL NOT show dormant controls for future provider, graph, timeline, guided workflow, or authoring features that do not yet exist.

#### Scenario: A preference cannot take effect
- **WHEN** an existing persisted preference is accepted by the data model but the shell does not apply it
- **THEN** Settings SHALL omit that control or clearly keep it out of the first implementation
- **AND** the app SHALL NOT present a preference that can be changed without affecting behavior.

### Requirement: Settings distinguish app and repository scope
The settings surface SHALL make app-wide controls, repository-history controls, current-repository controls, and validation/diagnostic data controls visually and behaviorally distinct.

#### Scenario: Settings entry is globally placed
- **WHEN** the shell renders the left panel
- **THEN** it SHALL show a Settings navigation entry pinned at the bottom of the left panel
- **AND** the Settings entry SHALL be visually distinct from repository selection and recent repository actions.

#### Scenario: Settings opens while a repository is active
- **WHEN** the user opens Settings from the shell
- **THEN** the active repository and workspace remain loaded in memory
- **AND** Settings SHALL replace the main workbench content area rather than opening in the selected-change or selected-spec inspector
- **AND** returning to the workbench preserves the current board, selection, filters, and inspector state unless the user chose a reset action.

#### Scenario: Settings uses one page for the first implementation
- **WHEN** Settings is open
- **THEN** the app SHALL render app, repository, current-repository, validation/diagnostics, and Studio Runner settings on one scrollable settings page
- **AND** the app SHALL NOT require nested settings navigation for the first implementation.

#### Scenario: Settings does not reserve an inspector panel
- **WHEN** Settings is open
- **THEN** Settings SHALL occupy the workbench content area beside the repository rail
- **AND** the shell SHALL NOT render or reserve a right-side inspector column for Settings.

#### Scenario: Settings opens without a repository
- **WHEN** no repository is active
- **THEN** app-wide and all-repository data controls remain available
- **AND** current-repository controls are hidden or disabled with clear inactive state.

### Requirement: Destructive local data actions require inline confirmation
The settings surface SHALL require inline confirmation before clearing app-local data or resetting app-local continuity state.

#### Scenario: User starts a destructive settings action
- **WHEN** the user activates a destructive local-data action
- **THEN** the affected action row SHALL enter a confirmation state with Confirm and Cancel actions
- **AND** the app SHALL NOT perform the mutation until the user confirms.

#### Scenario: User cancels a destructive settings action
- **WHEN** a destructive settings action is awaiting confirmation
- **AND** the user cancels it
- **THEN** the affected action row SHALL return to its default state
- **AND** the app SHALL leave persisted state unchanged.

#### Scenario: User confirms a destructive settings action
- **WHEN** a destructive settings action is awaiting confirmation
- **AND** the user confirms it
- **THEN** the app SHALL perform only the scoped app-local mutation
- **AND** the app SHALL show concise success or failure feedback.

### Requirement: Launch restore is user-controllable
The application SHALL allow users to control whether Studio automatically reopens the last successful repository on launch.

#### Scenario: Auto-restore is enabled
- **WHEN** the app launches with auto-restore enabled or unset
- **THEN** Studio MAY reopen the last successful repository using the existing candidate-open flow
- **AND** it re-indexes repository files from disk before displaying project state.

#### Scenario: Auto-restore is disabled
- **WHEN** the app launches with auto-restore disabled
- **THEN** Studio SHALL show the repository selection state without automatically opening the last repository
- **AND** recent repositories remain available for explicit user selection.

### Requirement: Automatic refresh is user-controllable
The application SHALL allow users to enable or disable automatic background refresh for the active repository.

#### Scenario: Automatic refresh is enabled
- **WHEN** a valid repository is active and automatic refresh is enabled or unset
- **THEN** Studio MAY refresh indexed OpenSpec state in the background using the existing refresh behavior.

#### Scenario: Automatic refresh is disabled
- **WHEN** automatic refresh is disabled
- **THEN** Studio SHALL NOT start the background repository refresh timer
- **AND** manual refresh remains available.

### Requirement: Recent repository history is manageable
The settings surface SHALL allow users to remove app-local recent repository history without modifying project files.

#### Scenario: User removes one recent repository
- **WHEN** the user removes a repository from recent history
- **THEN** Studio SHALL remove that path from app-local recent repositories
- **AND** if that path was the launch restore target, Studio SHALL clear the launch restore target.

#### Scenario: User clears all recent repositories
- **WHEN** the user clears recent repository history
- **THEN** Studio SHALL remove recent repositories and the launch restore target from app-local state
- **AND** it SHALL NOT delete, create, or modify any files in those repositories.

### Requirement: Current repository continuity can be reset
The settings surface SHALL allow users to reset app-local UI continuity for the active repository.

#### Scenario: User resets current repository UI state
- **WHEN** a repository is active and the user resets its UI continuity state
- **THEN** Studio SHALL clear persisted selected change, selected spec, change table sort, and spec table sort for that repository
- **AND** Studio SHALL keep the current in-memory workspace selection stable until the user reloads, switches repository, or navigates explicitly
- **AND** Studio SHALL continue deriving the repository workbench from current OpenSpec files.

### Requirement: Validation and diagnostic cache is manageable
The settings surface SHALL allow users to clear app-local validation snapshots and explain what diagnostic data may be stored.

#### Scenario: User clears current repository validation cache
- **WHEN** a repository is active and the user clears its validation snapshot
- **THEN** Studio SHALL remove the app-local validation snapshot for that repository
- **AND** the current workspace SHALL no longer treat the cleared snapshot as trusted validation.

#### Scenario: User clears all validation cache
- **WHEN** the user clears all validation snapshots
- **THEN** Studio SHALL remove app-local validation snapshots for every persisted repository
- **AND** it SHALL NOT modify OpenSpec files or run archive actions.

#### Scenario: Diagnostic storage is explained
- **WHEN** Settings shows validation or diagnostic data controls
- **THEN** it SHALL explain that cached validation data may include local paths, stdout, stderr, status codes, and parsed diagnostics
- **AND** it SHALL distinguish clearing app-local cache from changing repository files.


### Requirement: Global Studio Runner defaults are configurable
The settings surface SHALL expose durable global defaults for implemented Studio Runner execution behavior while keeping operational runner state and endpoint configuration in the Runner workspace.

#### Scenario: Runner defaults are available
- **GIVEN** Studio Runner behavior is implemented
- **WHEN** the user opens Settings
- **THEN** Settings SHALL include a Studio Runner settings section for global Runner defaults
- **AND** the section SHALL allow users to choose default model and effort values for future Studio-managed runner work
- **AND** the section copy SHALL make clear that these defaults apply globally across repositories to future Studio-managed dispatches
- **AND** effort choices SHALL include Default, Low, Medium, and High
- **AND** model choices SHALL include Default and an optional custom model id entry
- **AND** Settings SHALL NOT ship a curated model alias list until Studio can discover supported model aliases reliably
- **AND** the section SHALL NOT include the Runner endpoint editor in the first implementation
- **AND** default selections SHALL preserve Symphony/Codex configured defaults rather than forcing explicit values.

#### Scenario: Runner defaults apply only to future work
- **GIVEN** the user changes global Runner model or effort defaults
- **WHEN** Studio Runner work is dispatched later
- **THEN** Studio SHALL apply the changed defaults only to future dispatches
- **AND** already-running dispatches and historical Runner Log rows SHALL remain immutable records of the settings requested or applied at launch time.

#### Scenario: Runner defaults are sent with future Studio dispatches
- **GIVEN** the user has configured Runner model or effort defaults
- **WHEN** Studio dispatches future Runner work
- **THEN** the Studio-managed dispatch request SHALL include the selected non-default model or effort values
- **AND** default values SHALL omit or encode defaults so the Runner can use its configured defaults.

#### Scenario: Operational Runner state stays out of Settings
- **WHEN** the user opens Settings
- **THEN** Settings SHALL NOT host Runner endpoint editing, session-secret generation, start, stop, live status, stream connection state, selected-change dispatch, or Runner Log/history as primary controls
- **AND** those operational controls SHALL remain in the Runner workspace or selected-change action surface.

### Requirement: Future integrations contribute only real settings
The settings surface SHALL provide a place for implemented integrations to expose configuration without creating placeholder settings for unavailable capabilities.

#### Scenario: Runner integration is unavailable
- **WHEN** Studio Runner behavior has not been implemented
- **THEN** Settings SHALL NOT show runner configuration placeholders.

#### Scenario: Runner integration is available
- **WHEN** Studio Runner behavior has been implemented
- **THEN** Settings MAY show real durable Runner defaults
- **AND** Settings SHALL still keep endpoint editing, session-only secrets, lifecycle, and live operational history out of the durable settings surface.

#### Scenario: Provider choice is unavailable
- **WHEN** OpenSpec is the only implemented provider
- **THEN** Settings SHALL NOT show provider selection or adapter management controls.
