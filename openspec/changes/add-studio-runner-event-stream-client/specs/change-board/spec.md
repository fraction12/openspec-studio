## MODIFIED Requirements

### Requirement: Change detail agent dispatch
The change board SHALL provide an explicit **Build with agent** action for an active selected change when Studio Runner is configured and reachable, and SHALL surface runner execution updates for that selected change when available.

#### Scenario: Selected change history includes runner execution result
- **GIVEN** a selected change has a dispatch attempt
- **AND** Studio has received runner stream metadata for that attempt
- **WHEN** the change detail is shown
- **THEN** Studio SHALL show the runner execution status for that attempt
- **AND** Studio SHALL show PR URL, commit SHA, branch, session, workspace, and bounded blocker/error detail when available

#### Scenario: Delivery and execution states remain distinct
- **GIVEN** Studio has delivered a `build.requested` event successfully
- **AND** the runner later reports the run as blocked or failed
- **WHEN** the dispatch history is shown
- **THEN** Studio SHALL preserve the successful delivery/acceptance detail
- **AND** Studio SHALL separately show the runner execution status and failure or blocker detail
