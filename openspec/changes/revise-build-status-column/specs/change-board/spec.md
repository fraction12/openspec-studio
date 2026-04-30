## MODIFIED Requirements

### Requirement: Board table status cells stay scan-focused
The system SHALL keep change table status cells concise and avoid secondary text beneath pill badges.

#### Scenario: Change table renders build status
- **WHEN** a change appears in the board table
- **THEN** the status column SHALL be labeled **Build Status**
- **AND** the status cell SHALL show one primary workflow pill: **Validate**, **Ready**, **Incomplete**, or **Done**
- **AND** phase or explanatory subtext SHALL NOT be rendered under that pill in the table cell

#### Scenario: Change needs validation
- **WHEN** validation has not been run, is stale, is running, or is unknown for the current OpenSpec file snapshot
- **THEN** the build status SHALL be **Validate**
- **AND** the status SHALL direct users toward the existing validation action rather than implying the change is blocked

#### Scenario: Change is ready to build
- **WHEN** validation is current and passing for the current OpenSpec file snapshot
- **AND** the change has actionable open tasks
- **AND** the change has no blocking validation diagnostics
- **THEN** the build status SHALL be **Ready**

#### Scenario: Change is incomplete
- **WHEN** validation is current
- **AND** the change has missing, empty, or otherwise non-actionable tasks, or has blocking validation diagnostics
- **THEN** the build status SHALL be **Incomplete**
- **AND** missing `design.md` alone SHALL NOT cause **Incomplete** when OpenSpec does not require it for the current workflow state

#### Scenario: Change is done
- **WHEN** a change has a complete task list and appears in the archive-ready phase
- **THEN** the build status SHALL be **Done**
