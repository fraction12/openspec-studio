## MODIFIED Requirements
### Requirement: Archive actions use a restricted desktop bridge
The system SHALL execute archive actions through a restricted desktop bridge command, and SHALL report archive success only after verifying the repository state changed as expected.

#### Scenario: User archives from the desktop app
- **WHEN** the user activates a change archive action
- **THEN** the bridge validates the selected repository and change name
- **AND** it invokes only the supported OpenSpec archive operation for that change
- **AND** Studio rebuilds the workspace state from local files before reporting success

#### Scenario: Invalid archive input is supplied
- **WHEN** an archive request has an empty, path-like, or otherwise invalid change name
- **THEN** the bridge rejects the request
- **AND** no local files are moved by that request

#### Scenario: Archive completes
- **WHEN** OpenSpec archive succeeds for a change and local repository state confirms the mutation
- **THEN** the app refreshes local OpenSpec files
- **AND** the archived change appears through the app's derived archived-change data
- **AND** the active change no longer appears in the active change list

#### Scenario: Archive command exits successfully without moving files
- **WHEN** OpenSpec archive exits successfully but reports that no files changed or the active change remains present after refresh
- **THEN** Studio SHALL NOT report the archive as successful
- **AND** Studio SHALL surface a postcondition failure with the available command output and missing state evidence

## ADDED Requirements
### Requirement: Mutating operations verify postconditions
The desktop bridge and app shell SHALL verify explicit state postconditions for local operations that mutate repository files before presenting the operation as successful.

#### Scenario: Mutating command reports process success
- **WHEN** a supported mutating operation exits with a successful status code
- **THEN** Studio SHALL verify the operation-specific repository state change before showing success
- **AND** command success alone SHALL NOT be sufficient for user-facing success

#### Scenario: Mutating command is a no-op
- **WHEN** a mutating operation exits successfully but the expected repository state change is absent
- **THEN** Studio SHALL classify the operation as failed, no-op, or postcondition-failed rather than successful
- **AND** Studio SHALL keep the repository refreshable and avoid moving selection to nonexistent records

#### Scenario: Postcondition failure is diagnosed
- **WHEN** Studio detects a missing postcondition after a mutating operation
- **THEN** it SHALL record an operation issue with the operation type, target, timestamp, command status, stdout, stderr, and missing evidence when available
