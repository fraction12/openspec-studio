## ADDED Requirements

### Requirement: Validation failures expose command details
Validation command failures SHALL expose enough OpenSpec output for users to diagnose why validation did not complete cleanly.

#### Scenario: Validation command fails
- **WHEN** `openspec validate --all --json` exits unsuccessfully or returns unparseable output
- **THEN** the validation UI shows a command failure state
- **AND** the OpenSpec issue surface includes available stdout, stderr, and status code.

#### Scenario: Validation succeeds after a previous failure
- **WHEN** validation succeeds after an earlier validation command issue
- **THEN** the previous validation operation issue is cleared for the selected repository.
