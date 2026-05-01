## ADDED Requirements

### Requirement: Studio Runner Session delegates Runner Log history policy
The Studio Runner Session module SHALL keep owning operational runner workflow while delegating reusable Runner Log history policy to the Studio Runner Log Module.

#### Scenario: Operational workflow remains in Studio Runner Session
- **WHEN** Studio starts, stops, checks, streams, or dispatches through Studio Runner
- **THEN** Studio Runner Session SHALL continue to own lifecycle/status transitions, dispatch coordination, session-secret state, stream connection state, operation diagnostics, and user-facing runner operation messages.

#### Scenario: Runner history policy is shared
- **WHEN** Studio Runner Session records pending dispatches, lifecycle events, status events, stream events, or dispatch responses
- **THEN** it SHALL use the Studio Runner Log Module for attempt creation, merge, replacement, upsert, sorting, and cap behavior.

#### Scenario: Persistence and Runner workspace share log policy
- **WHEN** persisted Runner Log attempts are loaded or Runner workspace rows are displayed
- **THEN** persistence and UI code SHALL use the Studio Runner Log Module rather than duplicating runner history normalization, filtering, row identity, or label policy.

#### Scenario: Runner contracts remain stable
- **WHEN** Runner Log policy moves behind the Studio Runner Log Module
- **THEN** Studio Runner dispatch payloads, Tauri command names, endpoint handling, stream event DTO handling, and durable persistence shape SHALL remain compatible with existing behavior.
