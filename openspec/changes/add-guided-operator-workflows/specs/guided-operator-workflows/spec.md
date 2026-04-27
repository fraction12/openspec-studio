## ADDED Requirements

### Requirement: Guided OpenSpec operations
The system SHALL provide guided app workflows for OpenSpec operations without replacing the OpenSpec CLI as the source of truth.

#### Scenario: User previews a write operation
- **WHEN** a guided workflow would create, modify, move, or archive OpenSpec files
- **THEN** the app shows the planned changes before final confirmation

#### Scenario: User confirms a write operation
- **WHEN** the user confirms a guided operation
- **THEN** the app executes the corresponding OpenSpec operation in the selected repository
- **AND** refreshes derived state after the command completes

