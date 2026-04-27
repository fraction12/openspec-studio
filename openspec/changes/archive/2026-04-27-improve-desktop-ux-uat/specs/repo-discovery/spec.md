## ADDED Requirements

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
