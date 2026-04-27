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

