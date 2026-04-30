## MODIFIED Requirements

### Requirement: Board presents a repo-native workbench
The system SHALL present changes and specs as source-backed OpenSpec artifacts rather than generic dashboard records.

#### Scenario: Change board renders
- **WHEN** the user views changes
- **THEN** the board emphasizes change name, touched capabilities, task progress, and updated time
- **AND** controls, counts, and status labels remain visually secondary to the artifact list
- **AND** filesystem paths SHALL NOT be repeated under row titles or in the selected change inspector header

#### Scenario: Specs board renders
- **WHEN** the user views specs
- **THEN** the board emphasizes capability name, validation state, requirement count, and last updated time
- **AND** the presentation supports quick scanning without duplicate summary content in the same row
- **AND** filesystem paths SHALL NOT be repeated under row titles or in the selected spec inspector header

#### Scenario: Default board width fits desktop layouts
- **WHEN** the user views changes on a normal desktop window
- **THEN** the default table layout fits visible overview columns without horizontal scrolling
- **AND** archive-ready row actions remain visible without requiring horizontal scrolling
- **AND** manual change-column resizing remains available for users who want to reveal longer titles

#### Scenario: Board width is compact
- **WHEN** the board is narrower than the table's overview columns
- **THEN** the table preserves change/spec name, validation or build status, tasks, capabilities, updated time, and row actions when present
- **AND** the table scrolls horizontally instead of hiding or partially clipping columns
- **AND** compact shell breakpoints do not create hidden horizontal dead zones outside the table scroller

#### Scenario: Shared table renderer is used
- **WHEN** the app renders the Changes or Specs board
- **THEN** both boards use a shared table renderer for common table structure, row limits, scrolling, and interaction behavior
- **AND** each board still defines context-specific columns, labels, empty states, and actions

#### Scenario: Specs table renders validation state
- **WHEN** a spec row shows a validation pill
- **THEN** the column SHALL be titled `Validation`
- **AND** the pill SHALL show `Validate`, `Valid`, or `Invalid`
- **AND** the pill has the same visual padding and internal spacing as comparable status pills elsewhere in the app
- **AND** the label and status dot do not appear clipped or crowded

#### Scenario: Row titles need truncation
- **WHEN** a change or spec title is wider than its current table cell
- **THEN** the title truncates with width-based ellipsis
- **AND** resizing the change column reveals more of the title without relying on a fixed character cutoff

### Requirement: Inspector reinforces OpenSpec artifact hierarchy
The system SHALL make the inspector feel like a focused review surface for OpenSpec artifacts.

#### Scenario: Change detail opens
- **WHEN** a change is selected
- **THEN** the inspector presents the readable change title and artifact tabs with consistent alignment
- **AND** proposal, design, tasks, spec deltas, archive information, and validation are shown only when relevant to the selected change
- **AND** the inspector header SHALL NOT show duplicate source path, phase, or trust/status metadata

#### Scenario: Spec detail opens
- **WHEN** a spec is selected
- **THEN** the inspector presents the readable spec name and source preview
- **AND** the inspector header SHALL NOT show a `Base spec` pill, source path, validation status pill, or `Open file` action

#### Scenario: Artifact tab renders
- **WHEN** an artifact tab is selected
- **THEN** the content area prioritizes the selected artifact's real source text
- **AND** supporting metadata appears as low-emphasis context instead of repeated headline content
