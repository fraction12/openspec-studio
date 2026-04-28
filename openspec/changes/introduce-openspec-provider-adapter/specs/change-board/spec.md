## ADDED Requirements

### Requirement: Archive actions run through provider capability
The change board SHALL expose archive actions only when the active provider declares archive support for the selected item.

#### Scenario: OpenSpec archive action is used
- **WHEN** the OpenSpec provider is active and a change is archive-ready
- **THEN** the app may offer the archive action
- **AND** archive execution uses the existing allowlisted OpenSpec archive command path.

#### Scenario: Provider does not support archive
- **WHEN** the active provider does not support archive actions
- **THEN** archive controls are hidden or disabled
- **AND** the app does not infer or run an archive command from arbitrary repository content.
