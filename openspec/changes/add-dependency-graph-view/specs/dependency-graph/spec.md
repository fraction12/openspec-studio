## ADDED Requirements

### Requirement: Dependency graph view
The system SHALL show relationships between OpenSpec changes, capabilities, artifacts, validation issues, and archive readiness.

#### Scenario: User opens graph
- **WHEN** the user opens the dependency graph
- **THEN** the app shows derived nodes and relationships from indexed OpenSpec state

#### Scenario: User selects a graph node
- **WHEN** the user selects a graph node
- **THEN** the app opens or highlights the corresponding repo, change, spec, artifact, or validation detail

