## MODIFIED Requirements

### Requirement: Local Studio Runner workspace
The desktop shell SHALL provide Studio Runner as a first-class workspace-level surface, separate from selected change details, for local runner configuration, lifecycle, status, event streaming, and a repo-wide Runner Log.

#### Scenario: Runner event stream connects after runner is reachable
- **GIVEN** a real OpenSpec repository is open
- **AND** Studio Runner endpoint is configured
- **AND** Studio Runner is reachable
- **WHEN** Studio enters or refreshes the Runner workspace
- **THEN** Studio SHALL connect to the runner's local SSE event stream
- **AND** Studio SHALL derive the stream endpoint from the configured push dispatch endpoint
- **AND** Studio SHALL apply the same localhost-only endpoint restrictions used for runner dispatch

#### Scenario: Runner stream updates the Runner Log
- **GIVEN** Studio has recorded a local runner log event
- **AND** the runner stream emits an event with the same event ID
- **WHEN** Studio receives the stream event
- **THEN** Studio SHALL merge the execution metadata into the existing Runner Log record
- **AND** Studio SHALL NOT create a duplicate row for the same event ID

#### Scenario: Runner workspace shows all Studio Runner events
- **GIVEN** Studio Runner dispatch, stream, lifecycle, status, or error events exist for the current repository
- **WHEN** the user views the Runner workspace
- **THEN** Studio SHALL show them in a table titled **Runner Log**
- **AND** Studio SHALL NOT title the table **Build requests**
- **AND** Studio SHALL use subtext that describes runner events rather than only signed dispatches

#### Scenario: Runner workspace shows publication metadata
- **GIVEN** runner stream events include execution metadata
- **WHEN** the user views the Runner Log
- **THEN** Studio SHALL show runner execution status such as running, completed, blocked, or failed
- **AND** Studio SHALL show PR URL, commit SHA, branch name, workspace path, session ID, and bounded error detail when available

#### Scenario: Runner stream lifecycle follows local runner lifecycle
- **GIVEN** Studio starts, stops, restarts, or changes the configured runner endpoint
- **WHEN** runner reachability or endpoint state changes
- **THEN** Studio SHALL start, stop, or reconnect the runner event stream accordingly
- **AND** Studio SHALL expose bounded stream error or disconnected state without blocking the app
