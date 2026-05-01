## MODIFIED Requirements

### Requirement: Repository paths are supportive details, not primary controls
The system SHALL prioritize repository names and native actions while keeping full filesystem paths available for inspection and copying outside primary chrome.

#### Scenario: Repository path is long
- **WHEN** the active repository path exceeds the available sidebar or header width
- **THEN** the app displays the repository name as the primary label
- **AND** the workspace header SHALL NOT show the full path as persistent secondary text
- **AND** the full path remains available through copy, tooltip, recent-source detail, or a lower-emphasis detail affordance without breaking layout

#### Scenario: User needs the repository in Finder
- **WHEN** the user requests a filesystem action for the active repository
- **THEN** the app can reveal the repository folder in the operating system file manager

#### Scenario: User opens a repository
- **WHEN** the user uses the left repository panel
- **THEN** the panel SHALL show the native folder chooser and recent repositories
- **AND** the panel SHALL NOT expose an `Enter path manually` affordance
