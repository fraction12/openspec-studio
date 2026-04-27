## ADDED Requirements

### Requirement: Multi-repository workspace
The system SHALL allow users to view several local OpenSpec repositories in one workspace without moving or copying canonical project data.

#### Scenario: User adds repositories
- **WHEN** the user adds multiple local repositories
- **THEN** the app indexes each repository independently
- **AND** stores only workspace membership in app-local settings

#### Scenario: User runs repo-specific action
- **WHEN** the user triggers an action for one repository
- **THEN** the command runs in that repository root

