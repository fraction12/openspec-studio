## ADDED Requirements

### Requirement: Workspace indexing is provider-backed
The system SHALL derive workspace intelligence through the active spec provider.

#### Scenario: OpenSpec provider indexes files
- **WHEN** the OpenSpec provider is active
- **THEN** changes, specs, archived changes, artifacts, source paths, modified times, and diagnostics are derived from the selected repo's `openspec/` tree
- **AND** the resulting workspace model can be consumed by existing change/spec inspection views.

### Requirement: Provider model remains deterministic
The provider-backed indexing model SHALL be deterministic and inspectable.

#### Scenario: Workspace is refreshed
- **WHEN** the same repo files and command outputs are indexed again
- **THEN** the provider returns equivalent workspace data
- **AND** no LLM or generated adapter behavior is required for the built-in OpenSpec provider.
