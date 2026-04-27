# change-board Specification

## Purpose
TBD - created by archiving change build-local-desktop-companion. Update Purpose after archive.
## Requirements
### Requirement: Change board overview
The system SHALL provide a visual overview of OpenSpec changes for the selected repository.

#### Scenario: Changes are displayed
- **WHEN** active changes have been indexed
- **THEN** the app displays them in a board or table overview
- **AND** each change shows its name, artifact completeness, validation health, touched capabilities, and last modified time when available

#### Scenario: Change needs attention
- **WHEN** a change is missing artifacts, has blocked workflow status, or has validation errors
- **THEN** the board visually marks the change as needing attention
- **AND** the user can open the change detail to see the reason

#### Scenario: Overview uses progressive disclosure
- **WHEN** the app displays the change board
- **THEN** the board emphasizes overview-level fields needed for scanning
- **AND** detailed artifact, validation, task, and archive-readiness information is available after the user selects a change or opens a focused detail area

### Requirement: Task progress summary
The system SHALL summarize task progress for changes with task artifacts.

#### Scenario: Tasks contain checkboxes
- **WHEN** a change has a `tasks.md` artifact with markdown checkboxes
- **THEN** the app computes completed and total task counts
- **AND** it displays the progress on the change card or row

#### Scenario: Tasks are missing
- **WHEN** a change does not have a `tasks.md` artifact
- **THEN** the app marks task progress as unavailable or incomplete
- **AND** it does not imply implementation readiness

### Requirement: Change detail view
The system SHALL provide a detail view for an individual change.

#### Scenario: User opens a change
- **WHEN** the user selects a change from the board
- **THEN** the app shows proposal, design, tasks, and delta spec artifacts when present
- **AND** it shows validation and workflow status for that change when available

#### Scenario: Detail view preserves readability
- **WHEN** the user opens proposal, design, or task details
- **THEN** proposal and design previews use readable document-style typography rather than raw code styling
- **AND** lengthy task lists prioritize remaining tasks while completed tasks remain available through lower-priority disclosure

#### Scenario: User opens artifact externally
- **WHEN** the user chooses to open an artifact
- **THEN** the app opens the artifact in the user's configured editor or operating system default handler

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

