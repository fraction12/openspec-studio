# workspace-intelligence Specification

## Purpose
Define the repository-derived workspace model, specs browser, archived-history indexing, and extension points that let OpenSpec Studio grow beyond a single read-only repository view while preserving OpenSpec files as the source of truth.
## Requirements
### Requirement: Robust expansion path
The system SHALL preserve a product architecture that can expand beyond a single-repo read-only viewer without replacing OpenSpec as the source of truth.

#### Scenario: Archived state is rebuilt
- **WHEN** app-local caches or indexes are deleted
- **THEN** the app rebuilds archived change detail state from `openspec/changes/archive/`
- **AND** proposal, design, tasks, spec deltas, summary, task progress, touched capabilities, and archive metadata are derived from local OpenSpec files
- **AND** archive-heavy repositories remain usable without repeatedly scanning every file once per archived change

#### Scenario: Repository files are refreshed
- **WHEN** the app checks whether a repository's OpenSpec files changed
- **THEN** it can use file metadata and signatures without reading every Markdown file's full contents
- **AND** unchanged file content already held by the app remains reusable
- **AND** selected artifact content can still be loaded accurately from the real source file

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

#### Scenario: Archived artifacts are available to derived views
- **WHEN** archived change folders contain proposal, design, task, or spec delta artifacts
- **THEN** the app indexes those artifacts as historical read-only sources
- **AND** future search, timeline, and dependency views can distinguish archived artifacts from active change artifacts

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

### Requirement: Tooling measures production derivation paths
Performance tooling SHALL measure the production workspace indexing and view-model derivation paths, not only filesystem scan and file read time.

#### Scenario: Performance measurement runs
- **WHEN** the performance measurement script completes
- **THEN** it SHALL report scan/read timing, production indexing timing, derived model timing where available, and derived active/archive/spec counts.

### Requirement: Specs table sorts by updated time
The specs overview table SHALL sort specs by updated time with a visible updated-column sort affordance.

#### Scenario: Specs table first loads
- **WHEN** current specs are rendered
- **THEN** rows are sorted newest first by indexed spec updated time
- **AND** specs without known updated time appear after specs with known updated time.

#### Scenario: User toggles spec updated sort
- **WHEN** the user activates the specs table `Updated` column sort control
- **THEN** the specs table toggles between newest-first and oldest-first updated-time ordering
- **AND** the spec inspector remains attached to the same selected spec when that spec is still visible.

### Requirement: Workspace indexing is provider-backed
The system SHALL derive workspace intelligence through the active spec provider.

#### Scenario: OpenSpec provider indexes files
- **WHEN** the OpenSpec provider is active
- **THEN** changes, specs, archived changes, artifacts, source paths, modified times, and diagnostics are derived from the selected repo's `openspec/` tree
- **AND** the resulting workspace model can be consumed by existing change/spec inspection views.

#### Scenario: OpenSpec status data is indexed
- **WHEN** active OpenSpec changes are indexed
- **THEN** the provider loads supported `openspec status --change <name> --json` output with bounded concurrency and freshness-aware caching
- **AND** status failures are represented as diagnostics instead of invented workflow data.

#### Scenario: Provider supplies file signature
- **WHEN** the provider indexes file records
- **THEN** it supplies or preserves a file signature based on source paths, modified times, sizes, and file kinds
- **AND** validation staleness and background refresh logic can compare snapshots without re-reading every artifact body.

#### Scenario: Provider session owns refresh decision
- **WHEN** provider-backed metadata refresh observes the same file signature as the active workspace
- **THEN** the provider session skips full artifact reads and may refresh lightweight provider status such as Git status
- **AND** when the signature differs it rebuilds the provider workspace through the same indexing path used for initial load.

### Requirement: Provider model remains deterministic
The provider-backed indexing model SHALL be deterministic and inspectable.

#### Scenario: Workspace is refreshed
- **WHEN** the same repo files and command outputs are indexed again
- **THEN** the provider returns equivalent workspace data
- **AND** no LLM or generated adapter behavior is required for the built-in OpenSpec provider.

#### Scenario: Browser preview is shown
- **WHEN** the app is not running in the Tauri desktop runtime
- **THEN** any browser preview state is labeled as non-repository-backed
- **AND** it is not treated as a provider-indexed OpenSpec workspace.

### Requirement: Provider-backed workspace preserves current OpenSpec derivations
The provider-backed workspace model SHALL preserve current OpenSpec-derived change, spec, archive, validation, and artifact behavior.

#### Scenario: Existing OpenSpec workspace is loaded through provider
- **WHEN** a repository is loaded through the OpenSpec provider
- **THEN** active changes, archive-ready changes, archived changes, specs, task progress, touched capabilities, requirement counts, summaries, source previews, validation links, and updated timestamps match the current direct OpenSpec indexing behavior
- **AND** existing board and inspector views can render without duplicating OpenSpec-specific filesystem assumptions.

#### Scenario: Artifact content is needed
- **WHEN** the user selects an artifact tab or spec source preview
- **THEN** the app reads source text through the active provider artifact-read capability when available
- **AND** unavailable artifact reads are surfaced as provider diagnostics with path context.

