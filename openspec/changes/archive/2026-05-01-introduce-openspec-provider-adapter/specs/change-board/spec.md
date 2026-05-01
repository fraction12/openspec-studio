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

#### Scenario: No provider is active
- **WHEN** no provider matches the selected repository
- **THEN** the change board does not offer archive actions
- **AND** no archive command can be invoked from stale selected-change state.

### Requirement: Board rows use provider-backed workspace data
The change board SHALL render rows from the active provider's normalized workspace data.

#### Scenario: OpenSpec provider supplies changes
- **WHEN** the OpenSpec provider indexes active and archived changes
- **THEN** the change board renders change names, phases, task progress, touched capabilities, validation trust, updated time, and archive readiness from the provider-backed workspace
- **AND** row data remains derived from real OpenSpec files and OpenSpec status output.

#### Scenario: Provider workspace refreshes
- **WHEN** the active provider returns refreshed workspace data
- **THEN** the change board updates from the refreshed provider workspace
- **AND** the visible selection remains synchronized with current phase and search filters.
