# change-board Specification

## Purpose
TBD - created by archiving change build-local-desktop-companion. Update Purpose after archive.
## Requirements
### Requirement: Change board overview
The system SHALL provide a visual overview of OpenSpec changes for the selected repository.

#### Scenario: Archived changes are displayed
- **WHEN** archived changes have been indexed
- **THEN** the app displays them in the archived phase table
- **AND** each archived row shows an `Archived` state, real task progress when an archived tasks artifact exists, touched capabilities when archived spec deltas exist, and last modified time when available

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

#### Scenario: User opens an archived change
- **WHEN** the user selects an archived change from the board
- **THEN** the app shows archived proposal, design, tasks, and spec delta artifacts when present
- **AND** it provides file actions for archived artifacts that exist
- **AND** it does not show active validation or archive-readiness controls for the archived change

#### Scenario: Archived artifact is missing
- **WHEN** an archived change does not include a proposal, design, tasks, or spec delta artifact
- **THEN** the archived detail view omits the missing artifact tab or action
- **AND** it does not render disabled active-change controls that imply the app failed to load data

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

### Requirement: Board presents a repo-native workbench
The system SHALL present changes and specs as source-backed OpenSpec artifacts rather than generic dashboard records.

#### Scenario: Change board renders
- **WHEN** the user views changes
- **THEN** the board emphasizes change name, touched capabilities, task progress, and updated time
- **AND** controls, counts, and status labels remain visually secondary to the artifact list
- **AND** the source path is available from the selected change inspector rather than repeated under every row title

#### Scenario: Specs board renders
- **WHEN** the user views specs
- **THEN** the board emphasizes capability name, requirement count, and last updated time
- **AND** the presentation supports quick scanning without duplicate summary content in the same row
- **AND** the source path is available from the selected spec inspector rather than repeated under every row title

#### Scenario: Default board width fits desktop layouts
- **WHEN** the user views changes on a normal desktop window
- **THEN** the default table layout fits visible overview columns without horizontal scrolling
- **AND** archive-ready row actions remain visible without requiring horizontal scrolling
- **AND** manual change-column resizing remains available for users who want to reveal longer titles

#### Scenario: Board width is compact
- **WHEN** the board is narrower than the table's overview columns
- **THEN** the table preserves change/spec name, trust, tasks, capabilities, updated time, and row actions when present
- **AND** the table scrolls horizontally instead of hiding or partially clipping columns

#### Scenario: Row titles need truncation
- **WHEN** a change or spec title is wider than its current table cell
- **THEN** the title truncates with width-based ellipsis
- **AND** resizing the change column reveals more of the title without relying on a fixed character cutoff

### Requirement: Inspector reinforces OpenSpec artifact hierarchy
The system SHALL make the inspector feel like a focused review surface for OpenSpec artifacts.

#### Scenario: Change detail opens
- **WHEN** a change is selected
- **THEN** the inspector presents source path, phase, compact trust state, and artifact tabs with consistent alignment
- **AND** proposal, design, tasks, spec deltas, archive information, and validation are shown only when relevant to the selected change

#### Scenario: Artifact tab renders
- **WHEN** an artifact tab is selected
- **THEN** the content area prioritizes the selected artifact's real source text
- **AND** supporting metadata appears as low-emphasis context instead of repeated headline content

### Requirement: Footer presents repo-operational facts
The system SHALL use the footer for concise repository facts derived from current OpenSpec and Git state.

#### Scenario: Workspace footer renders
- **WHEN** a repository is loaded
- **THEN** the footer shows the last validation date/time when known
- **AND** it shows the latest indexed OpenSpec change by modified time
- **AND** it shows whether `openspec/` has uncommitted Git changes
- **AND** transient load or action messages remain available without replacing those facts

### Requirement: Workbench empty states stay practical
The system SHALL use factual, action-oriented empty states that match OpenSpec's lightweight tone.

#### Scenario: No rows match
- **WHEN** a filter or search produces no changes or specs
- **THEN** the empty state explains the current condition in concise language
- **AND** it offers the next practical action when one exists
- **AND** it avoids promotional or decorative copy

