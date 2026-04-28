## MODIFIED Requirements

### Requirement: Robust expansion path
The system SHALL preserve a product architecture that can expand beyond a single-repo read-only viewer without replacing OpenSpec as the source of truth.

#### Scenario: Repository files are refreshed
- **WHEN** the app checks whether a repository's OpenSpec files changed
- **THEN** it can use file metadata and signatures without reading every Markdown file's full contents
- **AND** unchanged file content already held by the app remains reusable
- **AND** selected artifact content can still be loaded accurately from the real source file

#### Scenario: Archived state is rebuilt
- **WHEN** app-local caches or indexes are deleted
- **THEN** the app rebuilds archived change detail state from `openspec/changes/archive/`
- **AND** proposal, design, tasks, spec deltas, summary, task progress, touched capabilities, and archive metadata are derived from local OpenSpec files
- **AND** archive-heavy repositories remain usable without repeatedly scanning every file once per archived change

### Requirement: Efficient derived workspace indexing
The system SHALL derive workspace views from local OpenSpec artifacts with work proportional to repository size.

#### Scenario: Workspace contains many changes and archived changes
- **WHEN** the app indexes OpenSpec file records
- **THEN** active changes, archived changes, specs, delta specs, modified-time summaries, and file lookup maps are built from shared normalized file data
- **AND** indexing avoids repeated full-file-list scans per change where a single pass can provide the same data

#### Scenario: Validation issues are displayed
- **WHEN** validation issues are available for a workspace
- **THEN** change-specific and spec-specific issue lookups are prepared once per workspace view
- **AND** rendering rows or inspectors does not repeatedly scan the full validation issue list for every item

#### Scenario: Task detail is needed
- **WHEN** the board renders task progress rows
- **THEN** it uses task counts derived from the real `tasks.md` content or OpenSpec status data
- **AND** full task group parsing is deferred until the selected change's task detail needs it

### Requirement: Bounded OpenSpec status loading
The system SHALL load OpenSpec workflow/status data without overwhelming the local machine.

#### Scenario: Multiple active changes need status
- **WHEN** the app needs `openspec status` data for multiple changes
- **THEN** it uses a batch status source when available or bounds per-change command concurrency
- **AND** status results are cached by change identity and relevant artifact freshness
- **AND** unchanged changes do not trigger redundant status commands during background refresh

#### Scenario: Status command fails
- **WHEN** a status command times out, fails, or returns unrecognized output
- **THEN** the app records the command diagnostic for that change or repository scope
- **AND** it does not invent OpenSpec data or mark unrelated changes invalid because of the command failure
