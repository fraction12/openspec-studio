## ADDED Requirements

### Requirement: Timeline activity view
The system SHALL show a chronological activity view derived from local repository metadata and OpenSpec state.

#### Scenario: User opens timeline
- **WHEN** the user opens the timeline view
- **THEN** the app shows derived OpenSpec activity events in chronological order

#### Scenario: User filters activity
- **WHEN** the user filters by repo, change, capability, or event type
- **THEN** the timeline only shows matching derived events

