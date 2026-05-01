# local-desktop-shell Specification Delta

## MODIFIED Requirements
### Requirement: Local Studio Runner workspace
The desktop shell SHALL provide Studio Runner as a first-class workspace-level surface, separate from selected change details, for local runner configuration, lifecycle, status, event streaming, execution-log inspection, and a repo-wide Runner Log.

#### Scenario: Runner workspace uses summary table plus expandable details
- **GIVEN** Studio Runner events exist for the current repository
- **WHEN** the user views the Runner workspace
- **THEN** Studio SHALL keep **Runner Log** as the primary summary table
- **AND** run rows SHALL be expandable to show run execution details
- **AND** Studio SHALL NOT replace the table with a terminal-style raw log.

#### Scenario: Runner Log uses row-kind-aware columns
- **GIVEN** the Runner Log contains actual run rows and non-run operational rows
- **WHEN** Studio renders the table
- **THEN** the table SHALL use columns equivalent to Event, State, Subject, Message, and Updated
- **AND** the Event column SHALL identify whether the row is a run, runner lifecycle event, stream event, or diagnostic event
- **AND** the Subject column SHALL show the change name for run rows and runner/stream context for non-run rows.

#### Scenario: Status semantics match row kind
- **GIVEN** the Runner Log contains both actual run rows and non-run operational rows
- **WHEN** the table renders state information
- **THEN** actual run rows SHALL use run statuses such as accepted, running, completed, blocked, failed, or conflict
- **AND** lifecycle, stream, and diagnostic rows SHALL use event-appropriate labels such as started, stopped, connected, disconnected, info, warning, or error
- **AND** lifecycle, stream, or diagnostic rows SHALL NOT appear as running, blocked, completed, or failed unless they describe an actual run.

#### Scenario: Repeated non-run events are collapsed
- **GIVEN** lifecycle, stream, or diagnostic events repeat with the same normalized meaning for the same repository and endpoint
- **WHEN** the user views the Runner Log
- **THEN** Studio SHALL collapse those duplicate non-run rows into one visible row
- **AND** Studio SHALL expose repeat count or latest-occurrence context when the row repeated
- **AND** Studio SHALL NOT collapse distinct run rows that have different event IDs or run IDs.

#### Scenario: Runner stream updates the Runner Log
- **GIVEN** Studio has recorded a local runner log event
- **AND** the runner stream emits an event with the same event ID
- **WHEN** Studio receives the stream event
- **THEN** Studio SHALL merge the execution metadata into the existing Runner Log record
- **AND** Studio SHALL NOT create a duplicate row for the same event ID.

#### Scenario: Runner workspace shows current Symphony metadata
- **GIVEN** runner stream events include available Symphony metadata
- **WHEN** the user views or expands a run row
- **THEN** Studio SHALL surface event ID, run ID, repository/change key, recorded time, and status when available
- **AND** Studio SHALL surface workspace path, workspace status, workspace create/update timestamps, and session ID when available
- **AND** Studio SHALL surface source repo path, base commit, branch, commit, PR URL/state/merged/closed timestamps, cleanup fields, and bounded error detail when available.

#### Scenario: Runner Log row shows execution details
- **GIVEN** a Runner Log run row has associated execution detail entries or summary metadata
- **WHEN** the user expands that row
- **THEN** Studio SHALL show chronological execution detail entries that explain runner, orchestrator, agent, tool, git, validation, publication, or cleanup activity
- **AND** Studio SHALL distinguish summary-derived milestones from first-class execution-log entries when necessary.

#### Scenario: Active runner progress is inspectable
- **GIVEN** a Studio Runner run is active
- **WHEN** the runner emits status or metadata updates
- **THEN** Studio SHALL update the expanded run details without requiring terminal access or manual workspace inspection.

#### Scenario: Execution logs are unavailable
- **GIVEN** Symphony does not provide first-class structured execution-log entries for a run
- **WHEN** the user expands the run row
- **THEN** Studio SHALL show available summary-derived milestones and metadata
- **AND** Studio SHALL show an explicit unavailable/not-yet-provided state for detailed execution logs instead of silently showing an empty detail area.

#### Scenario: Runner event stream connects after runner is online
- **GIVEN** a real OpenSpec repository is open
- **AND** Studio Runner endpoint is configured
- **AND** Studio Runner is online
- **WHEN** Studio enters or refreshes the Runner workspace
- **THEN** Studio SHALL connect to the runner's local SSE event stream
- **AND** Studio SHALL derive the stream endpoint from the configured push dispatch endpoint
- **AND** Studio SHALL apply the same localhost-only endpoint restrictions used for runner dispatch.

#### Scenario: Runner stream lifecycle follows local runner lifecycle
- **GIVEN** Studio starts, stops, restarts, or changes the configured runner endpoint
- **WHEN** runner availability or endpoint state changes
- **THEN** Studio SHALL start, stop, or reconnect the runner event stream accordingly
- **AND** Studio SHALL expose bounded stream error or disconnected state without blocking the app.

#### Scenario: Runner inspector stays action focused
- **WHEN** the user views the Runner workspace inspector
- **THEN** the inspector SHALL show runner lifecycle, endpoint, session secret, and event stream controls
- **AND** the inspector SHALL NOT show a `Repo runner` pill, runner availability pill, repository metadata list, or managed-by-Studio metadata list.
