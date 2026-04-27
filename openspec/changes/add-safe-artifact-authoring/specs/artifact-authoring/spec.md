## ADDED Requirements

### Requirement: Safe artifact authoring
The system SHALL allow in-app edits to selected OpenSpec artifacts while preserving OpenSpec files as canonical state.

#### Scenario: User edits markdown artifact
- **WHEN** the user edits and saves a supported markdown artifact
- **THEN** the app writes the change to the artifact file under `openspec/`
- **AND** refreshes derived state after the write

#### Scenario: User updates task checkbox
- **WHEN** the user toggles a task checkbox
- **THEN** the app updates the corresponding `tasks.md` checkbox on disk

