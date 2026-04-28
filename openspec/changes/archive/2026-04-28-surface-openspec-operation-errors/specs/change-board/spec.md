## ADDED Requirements

### Requirement: Change operation failures are contextual
Change-specific OpenSpec operation failures SHALL be visible in the affected change context.

#### Scenario: Archive command fails
- **WHEN** OpenSpec rejects an archive operation for a change
- **THEN** the selected change inspector shows the archive failure message
- **AND** the OpenSpec issue surface includes the raw command output when available.

#### Scenario: Status command fails
- **WHEN** `openspec status --change <name> --json` fails for a change
- **THEN** the change row and inspector continue to use conservative status
- **AND** the OpenSpec issue surface records the failed change status operation.
