## ADDED Requirements

### Requirement: Visible selection stays synchronized with board filters
The system SHALL keep the selected change and detail inspector synchronized with the current visible board rows.

#### Scenario: Phase filter hides selected change
- **WHEN** the user changes the active, archive-ready, or archived phase filter and the previously selected change is no longer visible
- **THEN** the app selects the first visible change in the new phase when one exists
- **AND** the inspector shows details for that visible change

#### Scenario: Search hides selected change
- **WHEN** the user enters a search query that hides the selected change
- **THEN** the app either selects the first visible matching change or shows an empty inspector for the filtered result set
- **AND** primary actions do not remain attached to a hidden change

#### Scenario: Filter has no matches
- **WHEN** no changes match the current phase and search filters
- **THEN** the board shows an empty result state
- **AND** the inspector does not show stale detail content from a previously visible change

### Requirement: Change board avoids redundant status presentation
The system SHALL present change state with clear hierarchy and without repeating the same state in multiple adjacent controls.

#### Scenario: Change is archive-ready
- **WHEN** the user is viewing the archive-ready phase
- **THEN** the row does not redundantly repeat archive-ready status when the phase context already communicates it
- **AND** the row still shows validation health, task progress, and any specific blocking reason when needed

#### Scenario: Change health is unknown or stale
- **WHEN** validation has not run or is stale
- **THEN** the board labels the health state in user-facing language
- **AND** the state indicates what action can restore trust

### Requirement: Change inspector follows consistent drill-down hierarchy
The system SHALL structure change detail content so users learn more as they move from table overview to inspector tabs.

#### Scenario: Change detail opens
- **WHEN** the user selects a visible change
- **THEN** the inspector header shows identity, health, source path, and clearly labeled file actions
- **AND** tab content aligns to the same gutter and type scale as the header

#### Scenario: Proposal or design preview is long
- **WHEN** proposal or design content exceeds the available inspector height
- **THEN** the preview scrolls with stable padding and without crowding the panel edge or status band

#### Scenario: Completed tasks are expanded
- **WHEN** the user expands completed tasks
- **THEN** task groups remain visually separated and scannable
- **AND** the scroll position and bottom padding keep the final task group readable

### Requirement: Board rows communicate that they are navigable
The system SHALL make selectable board rows visually and interactively clear.

#### Scenario: User hovers or focuses a row
- **WHEN** a row can open detail content
- **THEN** hover and focus states communicate row navigation without changing row dimensions
- **AND** keyboard focus exposes the same selection behavior as pointer interaction
