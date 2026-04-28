## ADDED Requirements

### Requirement: OpenSpec operation failures are inspectable
The desktop app SHALL surface failed OpenSpec-backed operations as durable, inspectable UI state.

#### Scenario: OpenSpec command fails
- **WHEN** an OpenSpec CLI command invoked by the app exits unsuccessfully or cannot be parsed
- **THEN** the app records an operation issue containing the operation type, user-facing message, timestamp, and available status code, stdout, and stderr
- **AND** the issue remains visible after the transient status message changes.

#### Scenario: OpenSpec file read fails
- **WHEN** a selected OpenSpec artifact cannot be read
- **THEN** the app shows an error in the artifact preview context
- **AND** the app records an operation issue for the failed artifact path.

#### Scenario: User dismisses operation issues
- **WHEN** the user dismisses visible OpenSpec operation issues
- **THEN** the issues are removed from the visible issue surface without changing repository files.
