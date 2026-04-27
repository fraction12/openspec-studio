## ADDED Requirements

### Requirement: Local OpenSpec search
The system SHALL search indexed OpenSpec content from local repositories and route results to their owning repo and artifact.

#### Scenario: User searches content
- **WHEN** the user enters a search term
- **THEN** the app searches proposals, designs, tasks, specs, spec deltas, and validation messages

#### Scenario: User opens a result
- **WHEN** the user selects a search result
- **THEN** the app opens the owning repository and relevant detail context

