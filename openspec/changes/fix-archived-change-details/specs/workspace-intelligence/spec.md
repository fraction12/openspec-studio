## MODIFIED Requirements

### Requirement: Robust expansion path
The system SHALL preserve a product architecture that can expand beyond a single-repo read-only viewer without replacing OpenSpec as the source of truth.

#### Scenario: Archived state is rebuilt
- **WHEN** app-local caches or indexes are deleted
- **THEN** the app rebuilds archived change detail state from `openspec/changes/archive/`
- **AND** proposal, design, tasks, spec deltas, summary, task progress, touched capabilities, and archive metadata are derived from local OpenSpec files

### Requirement: Search, timeline, and dependency views
The system SHALL support future robust visualizations derived from local OpenSpec artifacts and local repo metadata.

#### Scenario: Archived artifacts are available to derived views
- **WHEN** archived change folders contain proposal, design, task, or spec delta artifacts
- **THEN** the app indexes those artifacts as historical read-only sources
- **AND** future search, timeline, and dependency views can distinguish archived artifacts from active change artifacts
