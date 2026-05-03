## ADDED Requirements

### Requirement: Runner Bridge DTO Adapter owns bridge normalization
The system SHALL provide a Runner Bridge DTO Adapter module that normalizes Tauri bridge DTOs into Studio Runner session and log model inputs.

#### Scenario: Runner status DTO is normalized
- **WHEN** Studio receives runner status DTOs from the native bridge using snake_case, camelCase, missing, managed, recovered, custom, occupied, reachable, or offline fields
- **THEN** the Runner Bridge DTO Adapter SHALL derive the same RunnerStatus model previously derived by Studio Runner Session
- **AND** Studio Runner Session callers SHALL NOT need to know bridge field compatibility details.

#### Scenario: Runner stream event DTO is normalized
- **WHEN** Studio receives stream event DTOs from the native bridge using snake_case or camelCase fields
- **THEN** the Runner Bridge DTO Adapter SHALL derive the Runner Log stream event input while preserving identity, workspace, publication, cleanup, execution-log, message, and error metadata.

### Requirement: Studio Runner Session remains workflow-focused
Studio Runner Session SHALL keep owning operational runner workflow while delegating bridge DTO compatibility parsing to the Runner Bridge DTO Adapter.

#### Scenario: Session behavior remains stable
- **WHEN** the bridge DTO normalization moves behind the adapter module
- **THEN** session lifecycle, status checks, stream handling, dispatch coordination, runner log merging, payload shapes, persistence shape, and visible Runner copy SHALL remain compatible with existing behavior.
