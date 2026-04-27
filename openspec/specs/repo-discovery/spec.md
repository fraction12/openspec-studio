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

### Requirement: Repository opening preserves the active workspace until success
The system SHALL treat a newly selected repository path as a candidate until it has been validated and indexed successfully.

#### Scenario: Candidate repository is valid
- **WHEN** the user selects or enters a folder containing an `openspec/` directory
- **THEN** the app promotes that folder to the active repository
- **AND** the displayed workspace, recents, selected repo label, and status band update to that repository

#### Scenario: Candidate path is missing or inaccessible
- **WHEN** the user selects or enters a path that cannot be read
- **THEN** the previous valid workspace remains visible when one exists
- **AND** the candidate error is shown near the repository-open controls with recovery actions

#### Scenario: Candidate folder has no OpenSpec workspace
- **WHEN** the user selects or enters a readable folder without an `openspec/` directory
- **THEN** the app explains that no OpenSpec workspace was found
- **AND** it offers actions to choose another folder, retry, or return to the previous valid repository when one exists

### Requirement: Recent repositories behave as a repository switcher
The system SHALL present recent repositories as a switcher that includes the active repository and only persists successful local repository roots.

#### Scenario: Active repository appears in recents
- **WHEN** a repository is active
- **THEN** the recent repository list shows that repository as the current selection
- **AND** other recent repositories remain available for switching

#### Scenario: Failed candidate paths are not persisted
- **WHEN** repository opening fails because a path is missing, inaccessible, or not an OpenSpec workspace
- **THEN** that candidate path is not added to recent repositories
- **AND** the previous recent list remains intact

#### Scenario: User switches to a recent repository
- **WHEN** the user selects a recent repository
- **THEN** the app validates and indexes it using the same candidate-open flow as folder selection
- **AND** failure to reopen a recent repository does not remove the current valid workspace

### Requirement: Repository paths are supportive details, not primary controls
The system SHALL prioritize repository names and native actions while keeping full filesystem paths available for inspection and copying.

#### Scenario: Repository path is long
- **WHEN** the active repository path exceeds the available sidebar or header width
- **THEN** the app displays the repository name as the primary label
- **AND** the full path remains available through copy, tooltip, or detail affordance without breaking layout

#### Scenario: User needs the repository in Finder
- **WHEN** the user requests a filesystem action for the active repository
- **THEN** the app can reveal the repository folder in the operating system file manager

