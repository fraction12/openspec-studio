## ADDED Requirements

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
