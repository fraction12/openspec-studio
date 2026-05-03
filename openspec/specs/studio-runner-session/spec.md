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

#### Scenario: Current Symphony stream metadata is preserved
- **WHEN** Studio receives a runner stream payload
- **THEN** the Studio Runner Session module SHALL preserve available identity fields such as event ID, run ID, repository/change key, recorded time, and status
- **AND** it SHALL preserve available workspace/session fields such as workspace path, workspace status, workspace created/updated timestamps, and session ID
- **AND** it SHALL preserve available git/publication fields such as source repo path, base commit, branch, commit, PR URL/state/merged/closed timestamps
- **AND** it SHALL preserve available cleanup and error fields.

#### Scenario: Runner log row kinds are normalized
- **WHEN** Studio receives run, lifecycle, stream, status, or diagnostic runner events
- **THEN** the Studio Runner Session module SHALL classify each summary row by kind
- **AND** it SHALL derive dedupe keys and state labels appropriate to that row kind.

#### Scenario: Runner execution log entries are coordinated
- **WHEN** Studio receives structured execution log entries for a runner event or run
- **THEN** the Studio Runner Session module SHALL merge, order, bound, and expose those entries by run/event identity
- **AND** it SHALL preserve the existing Runner Log summary row behavior.

### Requirement: Studio Runner Session remains behavior-preserving
The Studio Runner Session extraction SHALL NOT move endpoint editing into Settings, change durable defaults, change Tauri command names, or change visible Runner copy except where required by Runner Log execution details, duplicate cleanup, or row-kind-aware state labels.

#### Scenario: Existing Runner policy helpers remain compatible
- **WHEN** tests exercise dispatch eligibility, payload creation, stream log merging, lifecycle log events, and dispatch history filtering
- **THEN** the results SHALL remain compatible with the existing app model behavior unless explicitly changed by row-kind, dedupe, or execution-detail requirements.

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

### Requirement: Studio Runner execution logs are structured and bounded
Studio SHALL represent runner execution logs as structured, bounded, run-scoped entries rather than unbounded raw terminal output.

#### Scenario: Execution log entry is received
- **WHEN** Studio receives an execution log entry for a known runner event or run
- **THEN** Studio SHALL associate it with that run/event identity
- **AND** Studio SHALL preserve its timestamp, source, level, phase, message, and bounded detail metadata when available.

#### Scenario: Summary metadata is converted into milestones
- **WHEN** no first-class execution log entries are available for a run
- **THEN** Studio SHALL derive bounded milestone entries from available status, workspace, publication, cleanup, and error metadata
- **AND** Studio SHALL mark detailed execution logs as unavailable/not-yet-provided when appropriate.

#### Scenario: Execution log content exceeds bounds
- **WHEN** a log entry or run log exceeds configured UI retention bounds
- **THEN** Studio SHALL truncate or drop older content according to the bounds
- **AND** Studio SHALL expose that truncation occurred.

#### Scenario: Execution logs are retained within bounds
- **WHEN** Studio stores execution detail entries
- **THEN** it SHALL retain at most the latest 200 entries per run
- **AND** it SHALL retain execution detail state for at most the latest 50 run rows per repository
- **AND** it SHALL truncate per-entry message/detail display around 4 KB.

#### Scenario: Execution logs are unavailable
- **WHEN** the runner does not provide execution logs, the stream is disconnected, or a detail request fails
- **THEN** Studio SHALL show an explicit unavailable/disconnected/error state instead of silently presenting an empty log.

### Requirement: Runner Log duplicate cleanup is row-kind aware
Studio SHALL collapse repeated non-run Runner Log rows without hiding distinct run attempts.

#### Scenario: Duplicate lifecycle or stream event repeats
- **WHEN** the same lifecycle, stream, status, or diagnostic event repeats for the same repository and endpoint with the same normalized message
- **THEN** Studio SHALL update the existing row's repeat count or latest timestamp instead of appending a visually identical row.

#### Scenario: Distinct run events look similar
- **WHEN** two actual run rows have different event IDs or run IDs
- **THEN** Studio SHALL keep them as distinct rows even if their status or message text matches.

### Requirement: Runner Log state labels match row meaning
Studio SHALL avoid applying run-only statuses to lifecycle, stream, status, or diagnostic rows.

#### Scenario: Non-run row is rendered
- **WHEN** a lifecycle, stream, status, or diagnostic row is displayed in the Runner Log
- **THEN** Studio SHALL render an event-appropriate severity/state label such as connected, disconnected, info, warning, or error, or omit the badge
- **AND** Studio SHALL NOT label the row running, blocked, completed, or failed unless the row describes an actual run.

### Requirement: Runner session state
Studio SHALL normalize local Studio Runner lifecycle, dispatch, event stream, setup, and run metadata into a bounded session model.

#### Scenario: Runner ownership state is represented
- **GIVEN** Studio checks a configured Studio Runner endpoint
- **WHEN** it records runner session state
- **THEN** the session model SHALL distinguish offline, managed, recovered, custom/user-managed, and occupied/non-matching listener states
- **AND** it SHALL preserve safe diagnostic metadata such as endpoint, PID when available, repo path when available, and user-facing recovery guidance.

#### Scenario: Persisted running row is reconciled with runner truth
- **GIVEN** Studio has a persisted Runner Log row for a repo/change with an accepted or running state
- **AND** runner health, stream, guarded process inspection, or explicit Studio stop/restart evidence proves no matching run is active
- **WHEN** Studio reconciles runner session state
- **THEN** Studio SHALL terminalize the local row as stale with a clear message
- **AND** Studio SHALL unlock the selected change's Build with agent action when no other active matching run exists.

#### Scenario: Unknown runner truth does not falsely clear active work
- **GIVEN** Studio has a persisted accepted or running Runner Log row
- **AND** runner status is unavailable or inconclusive
- **WHEN** Studio reconciles runner session state
- **THEN** Studio SHALL NOT mark the run terminal solely because the app lacks a fresh event
- **AND** Studio SHALL show uncertainty or disconnected state instead of silently unlocking the change.

#### Scenario: Runner stop terminalizes local active rows for matching runner
- **GIVEN** Studio stops a managed or recovered matching Studio Runner
- **WHEN** there are local accepted or running rows associated with that runner and repository
- **THEN** Studio SHALL mark those rows terminal with a stale message unless a terminal runner event already exists
- **AND** subsequent selected-change lock state SHALL use the terminalized rows.

#### Scenario: Stale is local reconciliation state
- **GIVEN** a Runner Log row is terminalized because Studio proved the matching run is no longer active without receiving a terminal runner event
- **WHEN** Studio stores and renders the row
- **THEN** Studio SHALL preserve `stale` as a local terminal execution state
- **AND** Studio SHALL NOT present the row as runner-reported cancelled, failed, or completed work.

#### Scenario: Dedicated active-run endpoint is not required for MVP reconciliation
- **GIVEN** Symphony does not expose a dedicated active-run state endpoint
- **WHEN** Studio has sufficient health, stream, guarded process, or explicit stop/restart evidence that no matching run remains active
- **THEN** Studio SHALL be able to reconcile and terminalize stale local rows without requiring a new runner API.

