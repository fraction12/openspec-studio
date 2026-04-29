## MODIFIED Requirements

### Requirement: Local Studio Runner workspace
The desktop shell SHALL provide Studio Runner as a first-class workspace-level surface, separate from selected change details, for local runner configuration, lifecycle, status, and repo-wide dispatch history.

#### Scenario: Runner controls live in a workspace tab
- **GIVEN** a real OpenSpec repository is open
- **WHEN** the user views workspace-level navigation
- **THEN** Studio SHALL show a Runner tab alongside Changes and Specs
- **AND** runner endpoint, session secret, start, stop, status, managed process detail, and repo-wide dispatch history SHALL live on the Runner tab rather than inside every selected-change inspector

#### Scenario: Configured runner is used for dispatch
- **GIVEN** the user has configured a Studio Runner endpoint and generated a session-only signing secret from the Runner tab
- **WHEN** Studio dispatches `build.requested`
- **THEN** Studio SHALL POST the signed payload to the configured runner push dispatch endpoint
- **AND** Studio SHALL avoid sending unrelated repository file contents by default

#### Scenario: Runner state is detected
- **GIVEN** Studio Runner configuration exists
- **WHEN** Studio checks runner availability
- **THEN** Studio SHALL classify the runner state as reachable or unavailable with bounded error detail
- **AND** Studio SHALL avoid blocking the app indefinitely while checking status

#### Scenario: Runner lifecycle uses safe local commands
- **GIVEN** Studio supports starting or stopping a local runner
- **WHEN** the user requests a lifecycle action
- **THEN** Studio SHALL start the Studio-owned Symphony runner using an explicit local runner path or bundled metadata rather than arbitrary shell command text
- **AND** Studio SHALL pass the current session-only signing secret to the runner process without persisting it in app settings
- **AND** Studio SHALL wait for the runner health endpoint before marking the runner reachable
- **AND** Studio SHALL report bounded success or failure detail

#### Scenario: Delivery failure is visible
- **GIVEN** Studio Runner endpoint and session secret are configured
- **WHEN** a `build.requested` delivery fails
- **THEN** Studio SHALL show the failure state for that delivery attempt
- **AND** Studio SHALL preserve enough local detail for the user to retry or diagnose the issue

### Requirement: Signed Studio Runner dispatch
The desktop shell SHALL send Studio Runner dispatch requests with stable event identity, timestamped signatures, and at-least-once-safe semantics.

#### Scenario: Dispatch uses push API instead of tracker polling
- **GIVEN** Studio Runner is configured
- **WHEN** Studio sends `build.requested`
- **THEN** Studio SHALL use the runner's push dispatch API
- **AND** Studio SHALL NOT require Linear configuration, tracker polling, or OpenSpec-as-tracker-adapter behavior for the OpenSpec dispatch path


#### Scenario: Dispatch request includes verification headers
- **GIVEN** Studio dispatches a `build.requested` event
- **WHEN** the outbound request is created
- **THEN** the request SHALL include a stable webhook event ID
- **AND** the request SHALL include a timestamp header
- **AND** the request SHALL include an HMAC-SHA256 signature header over the event ID, timestamp, and raw request body

#### Scenario: Payload is thin and change-scoped
- **GIVEN** Studio dispatches a `build.requested` event
- **WHEN** the payload is constructed
- **THEN** the payload SHALL identify exactly one repository/change pair
- **AND** the payload SHALL include validation state and relevant artifact paths
- **AND** the payload SHALL NOT include arbitrary repository file contents by default

#### Scenario: Duplicate delivery is safe
- **GIVEN** Studio retries a failed delivery
- **WHEN** the retry request is created
- **THEN** Studio SHALL preserve the original event identity for that delivery record
- **AND** the receiver SHALL be able to deduplicate the retry using the event ID

#### Scenario: Delivery is bounded
- **GIVEN** Studio sends a Studio Runner dispatch request
- **WHEN** the endpoint is slow, unavailable, or returns a large response
- **THEN** Studio SHALL apply a bounded timeout and bounded response/error capture
- **AND** Studio SHALL record a failed delivery state instead of blocking the app indefinitely
