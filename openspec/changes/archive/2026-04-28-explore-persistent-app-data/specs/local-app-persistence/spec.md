## ADDED Requirements

### Requirement: App-local state persistence
The system SHALL persist app-owned convenience state across launches without treating that state as canonical OpenSpec project data.

#### Scenario: Recent repositories persist
- **WHEN** the user successfully opens a local repository containing an OpenSpec workspace
- **THEN** the app records the repository path, display name, and last-opened time in app-local state
- **AND** the repository appears in the recent repositories list after the app restarts.

#### Scenario: Last repository can be restored
- **WHEN** the app launches and the last selected repository still exists with an `openspec/` directory
- **THEN** the app MAY reopen it or offer it as the primary continue option
- **AND** the repo is re-indexed from disk before project state is displayed.

#### Scenario: Missing recent repo is handled
- **WHEN** a persisted recent repository path no longer exists or no longer contains an `openspec/` directory
- **THEN** the app marks it unavailable or drops it from active selection
- **AND** it does not crash or create project files automatically.

### Requirement: Persisted state remains non-authoritative
The system SHALL never use persisted convenience data as a replacement for current OpenSpec files or CLI output.

#### Scenario: App persistence is deleted
- **WHEN** app-local persisted state is removed
- **THEN** the app can still open a repository and rebuild its OpenSpec index from disk and CLI output
- **AND** no canonical project information is lost.

#### Scenario: Persisted state conflicts with current files
- **WHEN** persisted selected change, selected spec, or validation data references items that no longer exist
- **THEN** the app falls back to the current indexed repo state
- **AND** it does not show missing persisted references as current project truth.

### Requirement: Per-repo UI continuity
The system SHALL persist lightweight per-repository UI state that improves inspection continuity.

#### Scenario: Selection state is restored
- **WHEN** the user reopens a repository with a persisted selected change or spec that still exists
- **THEN** the app restores that selection
- **AND** if the item no longer exists, the app chooses a valid current item or empty state.

#### Scenario: Table sort state is restored
- **WHEN** the user changes change-table or specs-table sort direction
- **THEN** the app records the preference in app-local state
- **AND** the same repo can restore that sort direction on a later launch.

### Requirement: Validation snapshots include staleness checks
The system SHALL persist validation snapshots only with enough file-signature data to determine whether the snapshot still matches the current repository state.

#### Scenario: Validation snapshot matches current files
- **WHEN** a persisted validation snapshot has the same file fingerprint as the current OpenSpec file signature
- **THEN** the app may show the validation result as current-cached
- **AND** it shows when that validation was checked.

#### Scenario: Validation snapshot is stale
- **WHEN** the current OpenSpec file signature differs from the persisted validation snapshot fingerprint
- **THEN** the app marks the validation result as stale or outdated
- **AND** it prompts or allows the user to rerun validation before trusting the result.

#### Scenario: Validation snapshot is missing
- **WHEN** no persisted validation snapshot exists for a repository
- **THEN** the app shows validation as not checked until validation is run.

### Requirement: Persistence failure is non-fatal
The system SHALL tolerate unavailable, malformed, or unwritable app-local persistence.

#### Scenario: Persisted state is corrupt
- **WHEN** app-local persisted state cannot be parsed or fails schema validation
- **THEN** the app ignores the invalid state and starts with fresh defaults
- **AND** it does not modify OpenSpec project files as part of recovery.

#### Scenario: Persistence write fails
- **WHEN** the app cannot write app-local state
- **THEN** the current session continues using in-memory state
- **AND** the app surfaces or logs the persistence problem without blocking OpenSpec inspection.
