## MODIFIED Requirements

### Requirement: Desktop shell provides clear global chrome
The system SHALL present global navigation, action, and status chrome with consistent control sizing, hierarchy, spacing, and recovery affordances.

#### Scenario: Long-running work is in progress
- **WHEN** the app is indexing files, refreshing files, running validation, reading artifact content, or running OpenSpec/Git commands
- **THEN** affected actions show loading or disabled states without shifting layout
- **AND** background refresh work does not unnecessarily flash global loading state
- **AND** the user can still identify the active repository and current trust state

#### Scenario: Background work completes after newer work
- **WHEN** an older load, refresh, artifact-read, validation, archive, or Git-status request completes after a newer request for the same view has started
- **THEN** the app ignores the stale completion
- **AND** it does not overwrite newer repository, workspace, selection, preview, validation, or Git state

#### Scenario: Detail panels scroll
- **WHEN** inspector content is longer than the available panel height
- **THEN** scrolling preserves readable gutters and stable scrollbar spacing
- **AND** the bottom status band does not obscure or visually compete with the detail content
- **AND** nested artifact preview regions do not trap normal vertical reading when the panel itself can scroll

### Requirement: Desktop bridge keeps local operations bounded
The system SHALL keep local filesystem and process work responsive, bounded, and recoverable from the packaged desktop app.

#### Scenario: Bridge runs a supported local command
- **WHEN** the bridge runs OpenSpec, Git, or operating-system helper commands
- **THEN** the command executes with a bounded timeout
- **AND** captured output is bounded to prevent unbounded memory growth
- **AND** timeout or output-limit failures are surfaced as command diagnostics

#### Scenario: Bridge scans OpenSpec files
- **WHEN** the bridge scans a repository's `openspec/` directory
- **THEN** expensive filesystem traversal runs outside latency-sensitive command handling
- **AND** symlinked directories do not cause recursive loops
- **AND** read or metadata failures are reported with enough path context for the UI to explain the issue

#### Scenario: Refresh work overlaps
- **WHEN** a background repository refresh is already in flight for the active repository
- **THEN** the app does not start another overlapping background refresh for that repository
- **AND** a manual refresh or archive-triggered refresh can supersede the background request safely
