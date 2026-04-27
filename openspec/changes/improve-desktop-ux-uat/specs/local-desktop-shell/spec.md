## ADDED Requirements

### Requirement: Native desktop repository opening
The system SHALL make native folder selection the primary way to open a local OpenSpec repository in the desktop app.

#### Scenario: User chooses a repository folder
- **WHEN** the user activates the primary repository-open action
- **THEN** the app opens a native folder selection dialog
- **AND** selecting a folder begins repository validation and indexing for that folder

#### Scenario: User prefers manual path entry
- **WHEN** the user needs to paste or type a repository path
- **THEN** the app provides manual path entry as a secondary or advanced control
- **AND** manual entry follows the same validation, indexing, and recovery behavior as folder selection

#### Scenario: User cancels folder selection
- **WHEN** the folder selection dialog is canceled
- **THEN** the active repository and workspace remain unchanged
- **AND** the app does not show an error state

### Requirement: Desktop shell provides clear global chrome
The system SHALL present global navigation, action, and status chrome with consistent control sizing, hierarchy, spacing, and recovery affordances.

#### Scenario: Global actions are displayed
- **WHEN** the workspace is loaded
- **THEN** repository opening, file refresh, validation, and file-opening actions use consistent button sizes and visual states
- **AND** labels distinguish opening a repository, refreshing indexed files, running validation, opening files, revealing files, and retrying failed actions

#### Scenario: Long-running work is in progress
- **WHEN** the app is indexing files, refreshing files, or running validation
- **THEN** affected actions show loading or disabled states without shifting layout
- **AND** the user can still identify the active repository and current trust state

#### Scenario: Detail panels scroll
- **WHEN** inspector content is longer than the available panel height
- **THEN** scrolling preserves readable gutters and stable scrollbar spacing
- **AND** the bottom status band does not obscure or visually compete with the detail content

### Requirement: First-run and launch recovery are actionable
The system SHALL guide users to a useful repository selection state on launch without relying on a hardcoded development path.

#### Scenario: Last repository can be restored
- **WHEN** the user launches the app after successfully opening a repository
- **THEN** the app restores the last successful repository when it still exists
- **AND** it indexes that repository without requiring the user to re-enter its path

#### Scenario: No repository can be restored
- **WHEN** the app has no successful repository history or the last repository is unavailable
- **THEN** the app shows a choose-folder empty state
- **AND** the empty state explains that OpenSpec Studio reads local repositories and does not create files during repository selection
