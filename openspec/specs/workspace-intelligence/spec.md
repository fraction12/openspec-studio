# workspace-intelligence Specification

## Purpose
TBD - created by archiving change build-local-desktop-companion. Update Purpose after archive.
## Requirements
### Requirement: Robust expansion path
The system SHALL preserve a product architecture that can expand beyond a single-repo read-only viewer without replacing OpenSpec as the source of truth.

#### Scenario: Derived state is rebuilt
- **WHEN** app-local caches or indexes are deleted
- **THEN** the app can rebuild its project state from local OpenSpec files and OpenSpec CLI output
- **AND** no canonical project data is lost

#### Scenario: Future workflow actions use OpenSpec primitives
- **WHEN** the app adds guided propose, apply, archive, or validation workflows
- **THEN** those workflows invoke or mirror OpenSpec CLI behavior
- **AND** they do not create a competing workflow format

### Requirement: Multi-repository workspace readiness
The system SHALL be designed so future versions can inspect multiple local OpenSpec repositories in one workspace dashboard.

#### Scenario: Multiple repos are added later
- **WHEN** the user groups multiple local repositories into a workspace
- **THEN** the app can show each repo's active changes, validation health, and stale state independently
- **AND** repo-specific actions still execute in the correct repository root

#### Scenario: Cross-repo health is summarized later
- **WHEN** multiple repositories are indexed
- **THEN** the app can summarize total active changes, invalid changes, stale validation, and archive-ready changes across the workspace

### Requirement: Search, timeline, and dependency views
The system SHALL support future robust visualizations derived from local OpenSpec artifacts and local repo metadata.

#### Scenario: User searches OpenSpec content
- **WHEN** search is added
- **THEN** it can search proposal, design, tasks, spec deltas, current specs, and validation messages across indexed repositories

#### Scenario: User opens a timeline view
- **WHEN** timeline view is added
- **THEN** it can show derived activity from file modification times, git history, validation runs, and archive state

#### Scenario: User opens a dependency graph
- **WHEN** dependency graph view is added
- **THEN** it can show relationships between changes, touched specs, capabilities, artifacts, and archive readiness

### Requirement: Safe artifact authoring readiness
The system SHALL leave room for future artifact editing without making editing necessary for the first useful version.

#### Scenario: User edits an artifact later
- **WHEN** safe artifact editing is added
- **THEN** edits write directly to the OpenSpec artifact file
- **AND** the app refreshes validation and artifact status after the write

#### Scenario: User only wants external editor workflow
- **WHEN** the user prefers an external editor
- **THEN** the app continues to support opening artifacts externally
- **AND** file watching refreshes the app after external edits

### Requirement: Specs browser supports progressive drill-down
The system SHALL let users move from a scan-friendly specs overview into a richer spec detail view without repeating the same information unnecessarily.

#### Scenario: Specs overview is populated
- **WHEN** one or more current specs are indexed
- **THEN** the specs page shows a concise overview table with capability, health, requirement count, and freshness information
- **AND** helper copy that only applies to empty states is not shown as primary content

#### Scenario: User selects a spec
- **WHEN** the user selects a visible spec row
- **THEN** the inspector shows spec identity, source path, health/trust state, requirement count, freshness, and file actions in a clear hierarchy
- **AND** the inspector reveals deeper derived details below the overview metadata

#### Scenario: Spec summary is placeholder content
- **WHEN** the spec content contains placeholder archive text or an empty summary
- **THEN** the app treats the summary as missing or incomplete
- **AND** it does not present placeholder text as polished product content

#### Scenario: Spec has validation messages
- **WHEN** validation output links issues to the selected spec
- **THEN** the spec inspector shows those messages in a validation section
- **AND** repository-level validation diagnostics remain separate from spec-specific issues

### Requirement: Specs selection stays synchronized with search
The system SHALL keep spec selection and spec inspector content synchronized with current search results.

#### Scenario: Search hides selected spec
- **WHEN** a spec search query hides the selected spec
- **THEN** the app selects the first visible matching spec or shows an empty filtered-result inspector
- **AND** primary actions do not remain attached to the hidden spec

#### Scenario: Search has no matches
- **WHEN** no specs match the search query
- **THEN** the specs table shows an empty search result state
- **AND** the inspector does not show stale details from a previously visible spec

### Requirement: Specs inspector uses the shared side-panel layout system
The system SHALL apply the same side-panel spacing, tabs, metadata, scroll, and action patterns to specs and changes.

#### Scenario: Spec detail content is sparse
- **WHEN** the selected spec has only metadata and limited content
- **THEN** the inspector still uses balanced spacing and clear section hierarchy
- **AND** it does not stretch sparse content into visually disconnected fragments

#### Scenario: Spec detail content is long
- **WHEN** the selected spec contains many requirements or validation messages
- **THEN** the inspector scrolls with stable gutters and bottom padding
- **AND** the user can still identify the selected spec and current trust state

### Requirement: Spec rows are fully selectable
The system SHALL allow users to select specs by activating any selectable area of a spec table row.

#### Scenario: User clicks a spec row
- **WHEN** the user clicks anywhere on a selectable spec row
- **THEN** the app selects that spec
- **AND** the inspector shows details for the selected spec

#### Scenario: User uses keyboard navigation
- **WHEN** a selectable spec row has keyboard focus and the user presses Enter or Space
- **THEN** the app selects that spec
- **AND** the row exposes focus and selected states without changing layout dimensions

### Requirement: Spec table trust cells stay scan-focused
The system SHALL keep spec table trust cells concise and avoid secondary text beneath pill badges.

#### Scenario: Spec table renders trust state
- **WHEN** a spec appears in the specs table
- **THEN** the trust cell shows the primary trust pill
- **AND** summary or explanatory subtext is not rendered under that pill in the table cell

### Requirement: Spec inspector previews source text
The system SHALL show the selected spec source text in the side panel using the same readable preview pattern as proposal and design content.

#### Scenario: User selects a spec with source content
- **WHEN** the user selects a spec whose source file content is available
- **THEN** the spec inspector displays a readable markdown preview of that source text
- **AND** key identity, trust, path, and file actions remain visible above the preview

#### Scenario: Spec source content is unavailable
- **WHEN** the selected spec source text cannot be loaded
- **THEN** the spec inspector shows a clear empty preview state
- **AND** it preserves available metadata and file actions

