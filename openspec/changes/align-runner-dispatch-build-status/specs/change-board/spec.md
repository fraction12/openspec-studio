## MODIFIED Requirements

### Requirement: Change detail agent dispatch
The change board SHALL provide an explicit **Build with agent** action for an active selected change when Studio Runner is configured and reachable, and SHALL surface runner execution updates for that selected change when available.

#### Scenario: Change inspector keeps dispatch compact
- **GIVEN** a selected active change is shown in the change inspector
- **WHEN** Studio renders the inspector header
- **THEN** the header SHALL show the selected change title and a compact **Build with agent** action
- **AND** the inspector header SHALL NOT show the change phase label, source path, file-opening action, change trust pill, runner status pill, runner detail copy, blocker list, retry action, or dispatch history

#### Scenario: Agent dispatch uses Build Status readiness
- **GIVEN** a selected active change has Build Status **Ready**
- **AND** the repository is real, Studio Runner endpoint is configured, a session secret exists, and Studio Runner is reachable
- **WHEN** Studio renders the change inspector action
- **THEN** the **Build with agent** action SHALL be enabled
- **AND** dispatch eligibility SHALL NOT repeat separate proposal, design, tasks, or validation readiness checks

#### Scenario: Agent dispatch waits for change readiness
- **GIVEN** a selected active change has Build Status **Validate**, **Incomplete**, or **Done**
- **WHEN** Studio renders the change inspector action
- **THEN** the **Build with agent** action SHALL be disabled
- **AND** the disabled reason SHALL direct the user to the change's Build Status readiness instead of reporting hidden artifact or task rules

#### Scenario: Runner setup still gates dispatch
- **GIVEN** a selected active change has Build Status **Ready**
- **WHEN** the repository is not real, Studio Runner endpoint is missing, the session secret is missing, or Studio Runner is not reachable
- **THEN** the **Build with agent** action SHALL be disabled for the relevant runner setup reason
