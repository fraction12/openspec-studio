## ADDED Requirements

### Requirement: Archive readiness derives from task completion
The application SHALL place an active change in the archive-ready phase when its indexed task list is complete.

#### Scenario: Completed tasks appear in archive ready
- **WHEN** a change has a task list with all tasks checked
- **THEN** Studio SHALL show the change on the Archive ready board
- **AND** validation freshness SHALL NOT be required for the change to appear there.

### Requirement: Archive actions validate before mutation
The application SHALL run OpenSpec validation immediately before archiving a change or bulk set of changes.

#### Scenario: Archive button is pressed
- **WHEN** the user presses Archive for an archive-ready change
- **THEN** Studio SHALL run validation for the selected repository
- **AND** Studio SHALL only invoke the archive command if validation passes without command or parse diagnostics.

#### Scenario: Validation fails before archive
- **WHEN** validation fails during the archive action
- **THEN** Studio SHALL NOT archive the change
- **AND** Studio SHALL show the validation failure.
