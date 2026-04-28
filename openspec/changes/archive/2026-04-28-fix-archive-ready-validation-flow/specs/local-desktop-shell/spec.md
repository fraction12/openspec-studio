## ADDED Requirements

### Requirement: Archive command failures are surfaced without losing repository state
The desktop archive flow SHALL surface OpenSpec archive failures from the command bridge and keep the repository refreshable.

#### Scenario: OpenSpec archive rejects a change delta
- **WHEN** OpenSpec archive fails before moving files
- **THEN** Studio SHALL report the command output to the user
- **AND** the active repository data SHALL remain refreshable.
