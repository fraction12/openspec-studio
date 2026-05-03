# studio-runner-session Specification Delta

## ADDED Requirements
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
