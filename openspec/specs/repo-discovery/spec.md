# repo-discovery Specification

## Purpose
TBD - created by archiving change build-local-desktop-companion. Update Purpose after archive.
## Requirements
### Requirement: OpenSpec workspace indexing
The system SHALL index the selected repository's OpenSpec workspace.

#### Scenario: Active changes are discovered
- **WHEN** the selected repo contains folders under `openspec/changes/` excluding archive folders
- **THEN** the app lists those folders as active changes
- **AND** it associates each change with its proposal, design, tasks, and delta spec artifacts when present

#### Scenario: Specs are discovered
- **WHEN** the selected repo contains specs under `openspec/specs/`
- **THEN** the app lists the specs by capability name
- **AND** it can open the corresponding spec artifact for preview

#### Scenario: Archived changes are discovered
- **WHEN** archived changes exist under the OpenSpec archive location
- **THEN** the app can list them separately from active changes
- **AND** archived changes do not appear as active work

### Requirement: Artifact status detection
The system SHALL determine whether required change artifacts exist and whether CLI-reported workflow status marks them ready, blocked, or done.

#### Scenario: Status command is available
- **WHEN** the app runs `openspec status --change <name> --json` successfully
- **THEN** it uses the returned artifact statuses and dependencies for that change

#### Scenario: Status command fails
- **WHEN** the status command fails for a change
- **THEN** the app surfaces the failure in that change's health state
- **AND** it may still show directly discovered files as best-effort context

### Requirement: File refresh
The system SHALL refresh indexed OpenSpec state when relevant files change.

#### Scenario: Artifact file changes
- **WHEN** a proposal, design, tasks, or spec artifact changes on disk
- **THEN** the app refreshes the affected repo index
- **AND** the UI reflects the latest status without requiring a full app restart

