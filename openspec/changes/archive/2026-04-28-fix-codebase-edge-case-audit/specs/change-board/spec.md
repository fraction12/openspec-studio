## ADDED Requirements

### Requirement: Archive readiness requires trusted validation
The application SHALL only place an active change in the archive-ready phase when required artifacts exist, tasks are complete, validation is current and passing for the same file snapshot, no validation diagnostics are present, and no linked blocking issues remain.

#### Scenario: Completed tasks without validation stay active
- **WHEN** a change has complete tasks and all required files
- **AND** validation has not run or is stale
- **THEN** the change SHALL remain active
- **AND** archive readiness SHALL explain that validation must be run.

### Requirement: Archive actions are guarded mutations
The application SHALL prevent duplicate archive submissions and SHALL confirm bulk archive operations before mutating files.

#### Scenario: Archive is already running
- **WHEN** an archive operation is in progress
- **THEN** row archive and bulk archive controls SHALL be disabled
- **AND** duplicate invocations SHALL be ignored.

#### Scenario: Bulk archive partially succeeds
- **WHEN** one or more changes archive successfully and a later archive fails
- **THEN** Studio SHALL refresh repository data before reporting the partial failure.

### Requirement: Shared board tables are accessible and consistent
Board tables SHALL preserve full-row pointer selection while exposing valid keyboard and assistive-technology semantics.

#### Scenario: Keyboard user selects rows
- **WHEN** focus is inside a board table
- **THEN** keyboard users SHALL be able to move between rows and select a row without tabbing through every row.
