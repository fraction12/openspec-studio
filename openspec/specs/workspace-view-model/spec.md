# workspace-view-model Specification

## Purpose
TBD - created by archiving change extract-workspace-view-model. Update Purpose after archive.
## Requirements
### Requirement: Workspace view projection
The Workspace View-Model module SHALL derive the UI-ready workspace view from indexed OpenSpec workspace data without requiring callers to import the app shell.

#### Scenario: Active changes are projected
- **WHEN** indexed active changes, file records, change status records, and validation state are provided
- **THEN** the module SHALL return change records with archive phase, build status, health, artifact state, summaries, updated timestamps, validation issues, and search text derived consistently with the existing workbench behavior.

#### Scenario: Archived changes are projected
- **WHEN** indexed archived changes are provided
- **THEN** the module SHALL return archived change records with archive metadata, archived artifacts, completed archive readiness, and display/search fields derived consistently with the existing workbench behavior.

#### Scenario: Specs are projected
- **WHEN** indexed base specs and validation state are provided
- **THEN** the module SHALL return spec records with validation state, requirement counts, summaries, requirement previews, timestamps, source content, and search text derived consistently with the existing workbench behavior.

### Requirement: Workspace view projection remains behavior-preserving
The Workspace View-Model extraction SHALL NOT change visible workspace behavior, provider behavior, OpenSpec file mutations, runner behavior, or persistence behavior.

#### Scenario: Existing view-model tests run against the module
- **WHEN** tests exercise archive readiness, build status, validation mapping, sorting helpers, and archived change projection
- **THEN** those tests SHALL import the Workspace View-Model module or existing policy helpers directly instead of importing the React app shell for projection behavior.

### Requirement: Workspace view projection supports adjacent application Modules
The Workspace View-Model module SHALL remain the source UI-ready projection consumed by adjacent Workbench Application Modules without requiring those Modules to import the React app shell.

#### Scenario: Navigation consumes workspace records
- **WHEN** workspace navigation policy needs change records, spec records, phases, detail tabs, and artifact availability
- **THEN** it SHALL consume the Workspace View-Model records and exported view helpers
- **AND** it SHALL NOT recreate OpenSpec indexing or source file parsing logic.

#### Scenario: Artifact detail consumes change records
- **WHEN** selected change detail state is derived
- **THEN** it SHALL consume ChangeRecord, Artifact, TaskProgress, ArchiveInfo, validation state, and existing tab/path helpers from the Workspace View-Model surface
- **AND** it SHALL NOT require callers to import `src/App.tsx` for artifact detail policy.

#### Scenario: Workspace projection ownership stays narrow
- **WHEN** repository opening, navigation, table interaction, artifact detail, or runner log policy changes
- **THEN** the Workspace View-Model module SHALL only change when its projected record shape or derivation contract must change.

