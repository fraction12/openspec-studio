## MODIFIED Requirements

### Requirement: Board rows are fully selectable
The system SHALL allow users to select changes by activating any selectable area of a change table row.

#### Scenario: Board tables share row behavior
- **WHEN** changes or specs are rendered in board tables
- **THEN** both tables use the same row selection and keyboard activation behavior
- **AND** page-specific cells and actions do not fork the underlying table interaction model

### Requirement: Board presents a repo-native workbench
The system SHALL present changes and specs as source-backed OpenSpec artifacts rather than generic dashboard records.

#### Scenario: Shared table renderer is used
- **WHEN** the app renders the Changes or Specs board
- **THEN** both boards use a shared table renderer for common table structure, row limits, scrolling, and interaction behavior
- **AND** each board still defines context-specific columns, labels, empty states, and actions

#### Scenario: Specs table renders trust state
- **WHEN** a spec row shows the `Check needed` trust pill
- **THEN** the pill has the same visual padding and internal spacing as comparable trust pills elsewhere in the app
- **AND** the label and status dot do not appear clipped or crowded
