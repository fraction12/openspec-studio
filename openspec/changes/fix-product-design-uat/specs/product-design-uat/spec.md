## ADDED Requirements

### Requirement: Stable desktop layout regions
The system SHALL keep persistent desktop application regions stable while allowing only intended content areas to scroll.

#### Scenario: Persistent regions remain fixed
- **WHEN** the app displays long proposals, long task lists, long artifact lists, or empty states
- **THEN** repository navigation, workspace header, board toolbar, inspector header, inspector tabs, and footer status remain in stable positions
- **AND** only board content, inspector body content, or explicit preview/list areas scroll

#### Scenario: Navigation does not become scrollable at normal desktop width
- **WHEN** the app is used at a normal desktop viewport width
- **THEN** tab rows and primary navigation controls fit without accidental horizontal scrolling
- **AND** content overflow does not push navigation or status bars out of place

### Requirement: Consistent component scale and states
The system SHALL use consistent visual styles, sizes, and interaction states for repeated controls and UI primitives.

#### Scenario: Buttons follow a defined scale
- **WHEN** toolbar buttons, row buttons, tab buttons, segmented controls, and full-width actions are displayed
- **THEN** each button uses the correct standard size for its role
- **AND** hover, focus, selected, loading, and disabled states are visually consistent

#### Scenario: Search can be recovered quickly
- **WHEN** a user enters a search query that hides all visible rows
- **THEN** the app provides a clear no-results state
- **AND** the user can quickly clear or change the search without losing orientation

### Requirement: Clear information hierarchy
The system SHALL make board views scannable and inspector views explanatory without equal visual emphasis on every detail.

#### Scenario: Board supports fast triage
- **WHEN** active changes are displayed in the board
- **THEN** rows prioritize change identity, actionable health, task progress, touched capabilities, and updated time
- **AND** selected row state is visually unambiguous

#### Scenario: Inspector supports drill-down
- **WHEN** a user selects a change
- **THEN** the inspector shows compact selected-item context and focused detail tabs
- **AND** detailed proposal, design, task, spec, artifact, and validation content is progressively disclosed

#### Scenario: Tasks preserve useful structure
- **WHEN** `tasks.md` contains grouped numbered tasks
- **THEN** the task detail view preserves or conveys that grouping
- **AND** remaining work is easier to scan than completed historical work

### Requirement: Status vocabulary is trustworthy
The system SHALL present global validation state, per-change health, artifact state, and task progress with distinct labels and visual semantics.

#### Scenario: Global validation is separate from change health
- **WHEN** validation is not run, stale, failed globally, or failed due to command diagnostics
- **THEN** the app presents that state in the global status area
- **AND** it does not use a per-change invalid badge unless change-specific evidence exists

#### Scenario: Progress is separate from health
- **WHEN** task progress is shown
- **THEN** progress visuals communicate task completion only
- **AND** blocked, invalid, stale, missing, and valid states use separate health/status treatments

### Requirement: Non-redundant information architecture
The system SHALL assign each repeated fact one primary home and avoid showing the same information multiple times on the same surface without a distinct purpose.

#### Scenario: Repository identity has one primary home
- **WHEN** a repository is selected
- **THEN** the current repository name and path are primarily represented in the workspace header
- **AND** repo switching controls and recent repo lists do not redundantly repeat the same selected-repo information as primary content

#### Scenario: Change identity has one primary home in the inspector
- **WHEN** a change is selected
- **THEN** the inspector presents the readable change title as the primary identity
- **AND** slug, path, status, and summary metadata appear only where they provide distinct context

#### Scenario: Proposal summary is not duplicated
- **WHEN** the Proposal tab shows the proposal content
- **THEN** the same first-paragraph summary is not redundantly repeated in the inspector header
- **AND** the header remains compact enough to preserve space for detail content

#### Scenario: Validation actions use one concept
- **WHEN** validation can be run from multiple locations
- **THEN** the action uses consistent wording and state
- **AND** contextual placements do not imply different validation operations unless behavior differs

### Requirement: UAT verification covers design quality
The system SHALL verify the polished interface with live UI review and responsive checks before the change is considered complete.

#### Scenario: Live desktop review passes
- **WHEN** the app is opened after implementation
- **THEN** Computer Use or equivalent visual inspection confirms stable layout, non-scrollable navigation, consistent controls, readable typography, clear status semantics, and reduced duplicate information

#### Scenario: Constrained width review passes
- **WHEN** the app is viewed at narrower desktop widths
- **THEN** persistent controls remain usable
- **AND** text does not overlap, controls do not resize unpredictably, and tabs do not become accidental scroll traps
