## MODIFIED Requirements

### Requirement: Change detail agent dispatch
The change board SHALL provide an explicit **Build with agent** action for an active selected change when Studio Runner is configured and reachable.

#### Scenario: Build with agent sends one change-scoped event
- **GIVEN** a real OpenSpec repository is open
- **AND** an active change is selected
- **AND** the change is eligible for build dispatch
- **AND** Studio Runner endpoint and session secret are configured
- **AND** Studio Runner is reachable or can be started successfully
- **WHEN** the user activates **Build with agent**
- **THEN** Studio SHALL send exactly one `build.requested` event for the selected change to Studio Runner's push dispatch endpoint
- **AND** the event SHALL identify the selected change
- **AND** Studio SHALL record the delivery attempt locally

#### Scenario: Ineligible change blocks dispatch
- **GIVEN** an active change is selected
- **AND** the change is missing required artifacts, actionable tasks, passing validation, runner configuration, or runner availability
- **WHEN** the change detail is shown
- **THEN** Studio SHALL not allow dispatch
- **AND** Studio SHALL show the reason dispatch is blocked

#### Scenario: Dispatch is never automatic
- **GIVEN** changes are created, edited, validated, or become archive-ready
- **WHEN** Studio refreshes workspace state
- **THEN** Studio SHALL NOT send `build.requested` unless the user explicitly activates **Build with agent**

#### Scenario: Runner status is visible near dispatch
- **GIVEN** the user views an active change
- **WHEN** Studio Runner is not configured, stopped, unreachable, incompatible, or reachable
- **THEN** Studio SHALL show the runner state near the dispatch action
- **AND** Studio SHALL make clear what action is needed before dispatch can occur

#### Scenario: Dispatch history is visible
- **GIVEN** a selected change has dispatch attempts
- **WHEN** the change detail is shown
- **THEN** Studio SHALL show recent delivery status for that change
- **AND** Studio SHALL include enough bounded detail to understand whether dispatch is pending, delivered, accepted, failed, or retryable

#### Scenario: Failed delivery can be manually retried
- **GIVEN** a selected change has a failed dispatch attempt
- **WHEN** the user retries the dispatch
- **THEN** Studio SHALL reuse the existing event ID or idempotency key for that delivery record
- **AND** Studio SHALL NOT create a second independent build request unless the user starts a fresh dispatch
