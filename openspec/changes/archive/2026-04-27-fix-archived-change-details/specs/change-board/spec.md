## MODIFIED Requirements

### Requirement: Change board overview
The system SHALL provide a visual overview of OpenSpec changes for the selected repository.

#### Scenario: Archived changes are displayed
- **WHEN** archived changes have been indexed
- **THEN** the app displays them in the archived phase table
- **AND** each archived row shows an `Archived` state, real task progress when an archived tasks artifact exists, touched capabilities when archived spec deltas exist, and last modified time when available

### Requirement: Change detail view
The system SHALL provide a detail view for an individual change.

#### Scenario: User opens an archived change
- **WHEN** the user selects an archived change from the board
- **THEN** the app shows archived proposal, design, tasks, and spec delta artifacts when present
- **AND** it provides file actions for archived artifacts that exist
- **AND** it does not show active validation or archive-readiness controls for the archived change

#### Scenario: Archived artifact is missing
- **WHEN** an archived change does not include a proposal, design, tasks, or spec delta artifact
- **THEN** the archived detail view omits the missing artifact tab or action
- **AND** it does not render disabled active-change controls that imply the app failed to load data

### Requirement: Change board avoids redundant status presentation
The system SHALL present change state with clear hierarchy and without repeating the same state in multiple adjacent controls.

#### Scenario: Change is archived
- **WHEN** the user is viewing archived changes
- **THEN** the row status uses the label `Archived`
- **AND** the inspector presents archived state as historical context rather than active validation health

### Requirement: Change inspector follows consistent drill-down hierarchy
The system SHALL structure change detail content so users learn more as they move from table overview to inspector tabs.

#### Scenario: Archived detail opens
- **WHEN** the user selects an archived change
- **THEN** the inspector header shows identity, archived state, source path, and a primary file action when available
- **AND** the inspector tabs only include archived historical content and archive metadata

#### Scenario: Archive info is shown
- **WHEN** the user opens archive information for an archived change
- **THEN** the app shows the archive folder path, parsed archived date when available, original change slug when available, and available archived files
- **AND** missing parsed metadata is presented as unknown rather than guessed
