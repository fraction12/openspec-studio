## ADDED Requirements

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
