## ADDED Requirements

### Requirement: Archive Operation Flow Module owns archive transition policy
The system SHALL provide an Archive Operation Flow Module that derives archive UI transitions from provider archive results without owning provider IO.

#### Scenario: Single archive result transition is derived
- **WHEN** a single selected change archive operation returns unsupported, stale, validation-blocked, partial, or success result data
- **THEN** the Archive Operation Flow Module SHALL derive the workspace update intent, validation snapshot intent, selected-change retention or replacement intent, operation issue intent, and user-facing message
- **AND** React callers SHALL NOT need to duplicate provider-result branching details.

#### Scenario: Batch archive result transition is derived
- **WHEN** a batch archive operation returns unsupported, stale, validation-blocked, partial, or success result data
- **THEN** the Archive Operation Flow Module SHALL derive the same transition categories as the single-change flow
- **AND** it SHALL preserve per-change partial result detail needed by the archive-ready board.

### Requirement: Archive Operation Flow remains behavior-preserving
The Archive Operation Flow Module extraction SHALL NOT change archive validation guardrails, provider contracts, OpenSpec file mutations, workspace projection behavior, validation snapshot persistence shape, native command names, public APIs, data schemas, external dependencies, or visible archive copy except where explicitly accepted in its implementation change.

#### Scenario: Existing archive behavior remains stable
- **WHEN** archive result policy moves behind the Archive Operation Flow Module
- **THEN** existing provider session, repository opening, workspace projection, and archived change tests SHALL continue to pass
- **AND** new module tests SHALL cover the moved archive transition policy at the module interface.
