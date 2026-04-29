## ADDED Requirements

### Requirement: Settings control existing app behavior
The settings surface SHALL expose controls only for behavior, persisted data, or integrations that the app already implements or that are delivered by an accepted active capability change.

#### Scenario: Settings are rendered
- **WHEN** the user opens Settings
- **THEN** each visible setting maps to current app behavior, current app-local state, or an implemented capability
- **AND** Settings SHALL NOT show dormant controls for future runner, provider, graph, timeline, guided workflow, or authoring features that do not yet exist.

#### Scenario: A preference cannot take effect
- **WHEN** an existing persisted preference is accepted by the data model but the shell does not apply it
- **THEN** Settings SHALL omit that control or clearly keep it out of the first implementation
- **AND** the app SHALL NOT present a preference that can be changed without affecting behavior.

### Requirement: Settings distinguish app and repository scope
The settings surface SHALL make app-wide controls, repository-history controls, current-repository controls, and validation/diagnostic data controls visually and behaviorally distinct.

#### Scenario: Settings opens while a repository is active
- **WHEN** the user opens Settings from the shell
- **THEN** the active repository and workspace remain loaded in memory
- **AND** returning to the workbench preserves the current board, selection, filters, and inspector state unless the user chose a reset action.

#### Scenario: Settings opens without a repository
- **WHEN** no repository is active
- **THEN** app-wide and all-repository data controls remain available
- **AND** current-repository controls are hidden or disabled with clear inactive state.

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

### Requirement: Future integrations contribute only real settings
The settings surface SHALL provide a place for implemented integrations to expose configuration without creating placeholder settings for unavailable capabilities.

#### Scenario: Runner integration is unavailable
- **WHEN** Studio Runner behavior has not been implemented
- **THEN** Settings SHALL NOT show runner endpoint, secret, lifecycle, or dispatch history controls.

#### Scenario: Provider choice is unavailable
- **WHEN** OpenSpec is the only implemented provider
- **THEN** Settings SHALL NOT show provider selection or adapter management controls.
