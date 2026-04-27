## ADDED Requirements

### Requirement: Board rows are fully selectable
The system SHALL allow users to select changes by activating any selectable area of a change table row.

#### Scenario: User clicks a change row
- **WHEN** the user clicks anywhere on a selectable change row
- **THEN** the app selects that change
- **AND** the inspector shows details for the selected change

#### Scenario: User uses keyboard navigation
- **WHEN** a selectable change row has keyboard focus and the user presses Enter or Space
- **THEN** the app selects that change
- **AND** the row exposes focus and selected states without changing layout dimensions

### Requirement: Board table status cells stay scan-focused
The system SHALL keep change table status cells concise and avoid secondary text beneath pill badges.

#### Scenario: Change table renders status
- **WHEN** a change appears in the board table
- **THEN** the status cell shows the primary health/status pill
- **AND** phase or explanatory subtext is not rendered under that pill in the table cell

### Requirement: Archive-ready rows expose archive actions
The system SHALL expose archive actions from the archive-ready phase.

#### Scenario: User archives one change
- **WHEN** the user is viewing archive-ready changes
- **THEN** each archive-ready row includes an Archive action for that change
- **AND** activating it archives that change through OpenSpec and refreshes the workspace

#### Scenario: User archives every ready change
- **WHEN** one or more changes are archive-ready
- **THEN** the archive-ready board exposes an Archive all action
- **AND** activating it archives the currently archive-ready changes and refreshes the workspace

#### Scenario: Archive operation fails
- **WHEN** an archive operation cannot complete
- **THEN** the app preserves the current workspace view
- **AND** it shows a clear failure message for the archive attempt
