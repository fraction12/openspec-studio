## ADDED Requirements

### Requirement: Safe artifact authoring
The system SHALL allow in-app edits to selected OpenSpec artifacts while preserving OpenSpec files as canonical state.

#### Scenario: User edits markdown artifact
- **WHEN** the user edits and saves a supported markdown artifact
- **THEN** the app writes the change to the artifact file under `openspec/`
- **AND** refreshes derived state after the write

#### Scenario: User cancels edits
- **WHEN** the user has unsaved artifact edits and cancels or closes the editor
- **THEN** the app keeps the file on disk unchanged
- **AND** it makes the discarded dirty state explicit before abandoning the edits

#### Scenario: User updates task checkbox
- **WHEN** the user toggles a task checkbox
- **THEN** the app updates the corresponding `tasks.md` checkbox on disk

#### Scenario: Artifact changed externally before save
- **WHEN** the artifact's on-disk content or freshness signature differs from the version loaded into the editor
- **THEN** the app rejects the save as a conflict
- **AND** it preserves the user's unsaved edit text so the user can compare, reload, or retry intentionally

#### Scenario: Save target leaves artifact boundary
- **WHEN** an artifact write request points outside the selected repository's `openspec/` tree or outside the selected artifact path
- **THEN** the app rejects the write before touching disk
- **AND** it reports the path-boundary failure as a user-visible authoring error

#### Scenario: Artifact write fails
- **WHEN** the app cannot write the selected artifact because of permissions, missing directories, disk errors, or bridge failure
- **THEN** the app preserves the unsaved edit text
- **AND** it refreshes or invalidates derived state only according to what is known from disk after the failed write
- **AND** it does not report validation or artifact status as refreshed from the unsaved content

#### Scenario: Artifact save succeeds
- **WHEN** a supported artifact save completes on disk
- **THEN** the app refreshes derived state from the saved file contents
- **AND** validation state is marked stale or refreshed according to the same trust rules used for external file changes
