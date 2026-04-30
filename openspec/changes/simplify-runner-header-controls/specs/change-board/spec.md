## MODIFIED Requirements

### Requirement: Change detail agent dispatch
The change board SHALL provide an explicit **Build with agent** action for an active selected change when Studio Runner is configured and reachable, and SHALL surface runner execution updates for that selected change when available.

#### Scenario: Change inspector keeps dispatch compact
- **GIVEN** a selected active change is shown in the change inspector
- **WHEN** Studio renders the inspector header
- **THEN** the header SHALL show the selected change title and a compact **Build with agent** action
- **AND** the inspector header SHALL NOT show the change phase label, source path, file-opening action, change trust pill, runner status pill, runner detail copy, blocker list, retry action, or dispatch history
- **AND** the **Build with agent** action SHALL preserve existing eligibility and disabled-state behavior
