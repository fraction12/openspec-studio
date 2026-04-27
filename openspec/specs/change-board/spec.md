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

