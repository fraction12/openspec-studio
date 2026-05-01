# change-board Specification

## Purpose
Define how OpenSpec Studio presents active, archive-ready, and archived changes as source-backed work items with trustworthy status, task progress, selection, archive actions, and inspector drill-down.
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

#### Scenario: Selected active change is already building
- **GIVEN** the user selects an active change in the inspector
- **AND** Studio Runner has an in-flight run for the same repository/change
- **WHEN** the inspector renders the primary runner action
- **THEN** the **Build with agent** button SHALL be disabled
- **AND** the button label SHALL read **Building...**
- **AND** the disabled state SHALL apply only to the selected change with the in-flight run.

#### Scenario: Building label uses a lightweight animated ellipsis
- **GIVEN** the selected change is already building
- **WHEN** the button label is shown
- **THEN** Studio SHALL animate the ellipsis in a simple, non-distracting loop
- **AND** the animation SHALL NOT change the button width or animate the whole button
- **AND** Studio SHALL show a static **Building...** label when reduced-motion preferences request it.

#### Scenario: Terminal run states re-enable normal action rules
- **GIVEN** a selected change previously had a Studio Runner run
- **WHEN** the latest known run status is completed, blocked, failed, or conflict
- **THEN** Studio SHALL stop treating that change as currently building
- **AND** the button SHALL fall back to the existing eligibility, retry, or unavailable behavior for that change.

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
- **AND** row styling avoids padding, border, or layout changes that cause visible content shifts

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

#### Scenario: Board tables share row behavior
- **WHEN** changes or specs are rendered in board tables
- **THEN** both tables use the same row selection and keyboard activation behavior
- **AND** page-specific cells and actions do not fork the underlying table interaction model

### Requirement: Board table status cells stay scan-focused
The system SHALL keep change table status cells concise and avoid secondary text beneath pill badges.

#### Scenario: Change table renders build status
- **WHEN** a change appears in the board table
- **THEN** the status column SHALL be labeled **Build Status**
- **AND** the status cell SHALL show one primary workflow pill: **Validate**, **Ready**, **Incomplete**, or **Done**
- **AND** phase or explanatory subtext SHALL NOT be rendered under that pill in the table cell

#### Scenario: Change needs validation
- **WHEN** validation has not been run, is stale, is running, or is unknown for the current OpenSpec file snapshot
- **THEN** the build status SHALL be **Validate**
- **AND** the status SHALL direct users toward the existing validation action rather than implying the change is blocked

#### Scenario: Change is ready to build
- **WHEN** validation is current and passing for the current OpenSpec file snapshot
- **AND** the change has actionable open tasks
- **AND** the change has no blocking validation diagnostics
- **THEN** the build status SHALL be **Ready**

#### Scenario: Change is incomplete
- **WHEN** validation is current
- **AND** the change has missing, empty, or otherwise non-actionable tasks, or has blocking validation diagnostics
- **THEN** the build status SHALL be **Incomplete**
- **AND** missing `design.md` alone SHALL NOT cause **Incomplete** when OpenSpec does not require it for the current workflow state

#### Scenario: Change is done
- **WHEN** a change has a complete task list and appears in the archive-ready phase
- **THEN** the build status SHALL be **Done**

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

### Requirement: Board interactions remain smooth at scale
The system SHALL keep board search, selection, scrolling, and column resizing responsive as OpenSpec workspaces grow.

#### Scenario: Many rows are visible
- **WHEN** the active, archive-ready, archived, or specs table contains many rows
- **THEN** the app avoids rendering or recalculating more row detail than needed for the visible interaction
- **AND** selecting a row updates the inspector without jank

#### Scenario: User searches rows
- **WHEN** the user types into a change or spec search field
- **THEN** filtering uses deferred or precomputed searchable text where needed
- **AND** typing remains responsive while preserving accurate results derived from current OpenSpec data

#### Scenario: User resizes the change column
- **WHEN** the user drags the change-column resize handle
- **THEN** width updates are throttled or applied through a lightweight visual path
- **AND** the table does not re-render every row on every pointer movement

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

### Requirement: Change Board Audit Coverage
The audit SHALL inspect the change-board implementation for selection, filtering, table behavior, archive actions, trust labels, derived row state, and viewport edge cases.

#### Scenario: Reviewer records concrete change-board findings
- **WHEN** a reviewer identifies a change-board issue
- **THEN** they SHALL record the finding under `openspec/changes/audit-codebase-edge-cases/reviews/`
- **AND** the finding SHALL include severity, file references, evidence, and a recommended fix.

### Requirement: Archive readiness derives from task completion
The application SHALL place an active change in the archive-ready phase when its indexed task list is complete.

#### Scenario: Completed tasks appear in archive ready
- **WHEN** a change has a task list with all tasks checked
- **THEN** Studio SHALL show the change on the Archive ready board
- **AND** validation freshness SHALL NOT be required for the change to appear there.

### Requirement: Archive actions validate before mutation
The application SHALL run OpenSpec validation immediately before archiving a change or bulk set of changes.

#### Scenario: Archive button is pressed
- **WHEN** the user presses Archive for an archive-ready change
- **THEN** Studio SHALL run validation for the selected repository
- **AND** Studio SHALL only invoke the archive command if validation passes without command or parse diagnostics.

#### Scenario: Validation fails before archive
- **WHEN** validation fails during the archive action
- **THEN** Studio SHALL NOT archive the change
- **AND** Studio SHALL show the validation failure.

### Requirement: Archive readiness requires trusted validation
The application SHALL only place an active change in the archive-ready phase when required artifacts exist, tasks are complete, validation is current and passing for the same file snapshot, no validation diagnostics are present, and no linked blocking issues remain.

#### Scenario: Completed tasks without validation stay active
- **WHEN** a change has complete tasks and all required files
- **AND** validation has not run or is stale
- **THEN** the change SHALL remain active
- **AND** archive readiness SHALL explain that validation must be run.

### Requirement: Archive actions are guarded mutations
The application SHALL prevent duplicate archive submissions and SHALL confirm bulk archive operations before mutating files.

#### Scenario: Archive is already running
- **WHEN** an archive operation is in progress
- **THEN** row archive and bulk archive controls SHALL be disabled
- **AND** duplicate invocations SHALL be ignored.

#### Scenario: Bulk archive partially succeeds
- **WHEN** one or more changes archive successfully and a later archive fails
- **THEN** Studio SHALL refresh repository data before reporting the partial failure.

### Requirement: Shared board tables are accessible and consistent
Board tables SHALL preserve full-row pointer selection while exposing valid keyboard and assistive-technology semantics.

#### Scenario: Keyboard user selects rows
- **WHEN** focus is inside a board table
- **THEN** keyboard users SHALL be able to move between rows and select a row without tabbing through every row.

### Requirement: Change operation failures are contextual
Change-specific OpenSpec operation failures SHALL be visible in the affected change context.

#### Scenario: Archive command fails
- **WHEN** OpenSpec rejects an archive operation for a change
- **THEN** the selected change inspector shows the archive failure message
- **AND** the OpenSpec issue surface includes the raw command output when available.

#### Scenario: Status command fails
- **WHEN** `openspec status --change <name> --json` fails for a change
- **THEN** the change row and inspector continue to use conservative status
- **AND** the OpenSpec issue surface records the failed change status operation.

### Requirement: Change tables sort by updated time
The change board SHALL sort change rows by updated time with a visible updated-column sort affordance.

#### Scenario: Change table first loads
- **WHEN** changes are rendered in the active, archive-ready, or archived table
- **THEN** rows are sorted newest first by their indexed updated time
- **AND** rows without known updated time appear after rows with known updated time.

#### Scenario: User toggles updated sort
- **WHEN** the user activates the `Updated` column sort control
- **THEN** the table toggles between newest-first and oldest-first updated-time ordering
- **AND** the updated column header shows the active direction with a sort icon or equivalent visual affordance.

#### Scenario: Sorting changes visible row order
- **WHEN** sorting changes the order of visible changes
- **THEN** current selection remains attached to the same change when that change is still visible
- **AND** keyboard row navigation follows the newly sorted visual order.

#### Scenario: Shared table behavior remains intact
- **WHEN** updated-time sorting is active
- **THEN** full-row selection, keyboard activation, row limiting, horizontal scrolling, and column resizing continue to use the shared board table behavior.

### Requirement: Change detail agent dispatch
The change board SHALL provide an explicit **Build with agent** action for an active selected change when Studio Runner is configured and reachable, and SHALL surface runner execution updates for that selected change when available.

#### Scenario: Change inspector keeps dispatch compact
- **GIVEN** a selected active change is shown in the change inspector
- **WHEN** Studio renders the inspector header
- **THEN** the header SHALL show the selected change title and a compact **Build with agent** action
- **AND** the inspector header SHALL NOT show the change phase label, source path, file-opening action, change trust pill, runner status pill, runner detail copy, blocker list, retry action, or dispatch history

#### Scenario: Agent dispatch uses Build Status readiness
- **GIVEN** a selected active change has Build Status **Ready**
- **AND** the repository is real, Studio Runner endpoint is configured, a session secret exists, and Studio Runner is reachable
- **WHEN** Studio renders the change inspector action
- **THEN** the **Build with agent** action SHALL be enabled
- **AND** dispatch eligibility SHALL NOT repeat separate proposal, design, tasks, or validation readiness checks

#### Scenario: Agent dispatch waits for change readiness
- **GIVEN** a selected active change has Build Status **Validate**, **Incomplete**, or **Done**
- **WHEN** Studio renders the change inspector action
- **THEN** the **Build with agent** action SHALL be disabled
- **AND** the disabled reason SHALL direct the user to the change's Build Status readiness instead of reporting hidden artifact or task rules

#### Scenario: Runner setup still gates dispatch
- **GIVEN** a selected active change has Build Status **Ready**
- **WHEN** the repository is not real, Studio Runner endpoint is missing, the session secret is missing, or Studio Runner is not reachable
- **THEN** the **Build with agent** action SHALL be disabled for the relevant runner setup reason

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

