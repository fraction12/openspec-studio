## ADDED Requirements

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
