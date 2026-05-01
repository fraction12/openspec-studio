## ADDED Requirements

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
