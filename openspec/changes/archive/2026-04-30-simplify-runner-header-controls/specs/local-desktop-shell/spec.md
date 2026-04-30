## MODIFIED Requirements

### Requirement: Desktop shell provides clear global chrome
The system SHALL present global navigation, action, and status chrome with consistent control sizing, hierarchy, spacing, and recovery affordances.

#### Scenario: Workspace header shows runner status
- **WHEN** a repository workspace is loaded
- **THEN** the workspace header SHALL show a compact Studio Runner status pill beside the Changes, Specs, and Runner view selector
- **AND** the status pill SHALL use the same runner status classification as Studio Runner controls
- **AND** the status pill SHALL remain compact and SHALL NOT duplicate runner setup, lifecycle, or history controls
