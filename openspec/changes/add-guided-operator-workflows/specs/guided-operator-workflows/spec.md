## ADDED Requirements

### Requirement: Guided OpenSpec operations
The system SHALL provide guided app workflows for OpenSpec operations without replacing the OpenSpec CLI as the source of truth.

#### Scenario: Existing flows are extended rather than duplicated
- **WHEN** guided workflows address archive or validation behavior
- **THEN** they build on the app's existing archive and validation flows
- **AND** they add only the needed confirmation, diagnostics, or preview affordances instead of creating separate archive or validation implementations

#### Scenario: User previews a write operation
- **WHEN** a guided propose or apply workflow would create, modify, or move OpenSpec files
- **THEN** the app shows the planned changes before final confirmation

#### Scenario: User confirms a write operation
- **WHEN** the user confirms a guided operation
- **THEN** the app executes the corresponding OpenSpec operation in the selected repository
- **AND** refreshes derived state after the command completes
