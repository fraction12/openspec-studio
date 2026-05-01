# studio-runner-session Specification

## Purpose
TBD - created by archiving change deepen-studio-runner-modules. Update Purpose after archive.
## Requirements
### Requirement: Studio Runner Session owns operational runner workflow
The Studio Runner Session module SHALL concentrate frontend operational Runner behavior behind a module interface while preserving existing UI behavior and persistence state.

#### Scenario: Runner lifecycle operations are coordinated
- **WHEN** the app starts, stops, restarts, or checks Studio Runner status
- **THEN** the Studio Runner Session module SHALL own the operational status transitions, session-secret state updates, generation guards, lifecycle log records, and user-facing operation messages used by the shell.

#### Scenario: Runner dispatch is coordinated
- **WHEN** the app dispatches a selected active change to Studio Runner
- **THEN** the Studio Runner Session module SHALL coordinate readiness checks, pre-dispatch validation, payload creation, pending attempt persistence, dispatch response handling, operation issue recording, and final message updates without changing the existing payload shape or persistence format.

#### Scenario: Runner stream events are coordinated
- **WHEN** Studio Runner stream events or stream errors arrive
- **THEN** the Studio Runner Session module SHALL normalize stream DTOs, update stream status, merge log events into persisted dispatch history, and preserve the existing Runner Log behavior.

### Requirement: Studio Runner Session remains behavior-preserving
The Studio Runner Session extraction SHALL NOT add Runner functionality, move endpoint editing into Settings, change durable defaults, change Tauri command names, or change visible Runner copy except where unavoidable for equivalent status reporting.

#### Scenario: Existing Runner policy helpers remain compatible
- **WHEN** tests exercise dispatch eligibility, payload creation, stream log merging, lifecycle log events, and dispatch history filtering
- **THEN** the results SHALL remain compatible with the existing app model behavior.

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

