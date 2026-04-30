## MODIFIED Requirements

### Requirement: Local Studio Runner workspace
The desktop shell SHALL provide Studio Runner as a first-class workspace-level surface, separate from selected change details, for local runner configuration, lifecycle, status, repo runner settings, and repo-wide dispatch history.

#### Scenario: Runner controls live in a workspace tab
- **GIVEN** a real OpenSpec repository is open
- **WHEN** the user views workspace-level navigation
- **THEN** Studio SHALL show a Runner tab alongside Changes and Specs
- **AND** runner endpoint, session secret, start, stop, status, and managed process detail SHALL be shown in the Runner page's context inspector rather than showing a stale selected change or spec inspector
- **AND** the main Runner workspace SHALL show repo runner model and effort settings above the Runner Log
- **AND** repo-wide runner history SHALL be shown in the main Runner workspace as a log-sized surface with enough width and height for runner output
- **AND** the main Runner workspace SHALL use existing board/inspector/card/list primitives rather than bespoke one-off controls where an existing pattern fits

#### Scenario: Repo runner settings apply to future runner work
- **GIVEN** the user is viewing the Runner workspace
- **WHEN** the user selects a model or effort level
- **THEN** Studio SHALL treat those selections as repo-wide settings for future Studio-managed runner work from the active repository
- **AND** Studio SHALL NOT treat those selections as one-off overrides for only the selected change
- **AND** Studio SHALL NOT rewrite historical runner log rows when settings change
- **AND** default selections SHALL preserve Symphony-owned defaults rather than forcing explicit values

#### Scenario: Running dispatch keeps launch settings
- **GIVEN** Studio Runner work is already running for the active repository
- **WHEN** the user changes the repo runner model or effort setting
- **THEN** Studio SHALL apply the changed settings only to future dispatches
- **AND** Studio SHALL NOT imply that already-running work has adopted settings it was not launched with
- **AND** historical runner log rows SHALL remain immutable records of the settings requested or applied for each dispatch

#### Scenario: Runner history table keeps columns readable
- **GIVEN** repo-wide runner history includes long change names, event IDs, response run IDs, timestamps, and execution settings
- **WHEN** the user views the Runner workspace runner log
- **THEN** Studio SHALL allocate stable column widths and spacing for status, event, response, updated data, and execution settings
- **AND** long event or response identifiers SHALL truncate or wrap within their own cells without overlapping adjacent columns
- **AND** updated timestamps SHALL remain readable without being covered by response text

### Requirement: Signed Studio Runner dispatch
The desktop shell SHALL send Studio Runner dispatch requests with stable event identity, timestamped signatures, at-least-once-safe semantics, a thin change-scoped payload, and optional bounded execution metadata for repo runner defaults.

#### Scenario: Dispatch includes explicit repo runner execution settings
- **GIVEN** the user selected an explicit repo runner model or effort setting
- **WHEN** Studio sends a `build.requested` dispatch
- **THEN** Studio SHALL serialize the explicit non-default selections under bounded execution metadata in the signed event payload
- **AND** Studio SHALL continue to send only the repo/change/work request and approved execution preferences, not arbitrary repository file contents or command strings
- **AND** the execution metadata SHALL be covered by the same raw-body signature as the rest of the event

#### Scenario: Payload preserves runner defaults
- **GIVEN** model and effort are left as default selections
- **WHEN** Studio sends a `build.requested` dispatch
- **THEN** Studio SHALL allow Symphony to apply its configured defaults
- **AND** Studio SHALL omit execution metadata fields for default selections rather than serializing misleading explicit values

#### Scenario: Symphony receives repo runner execution settings
- **GIVEN** Studio sends a signed `build.requested` dispatch with execution metadata
- **WHEN** Symphony accepts the event
- **THEN** Symphony is expected to parse and validate the optional model and effort fields
- **AND** Symphony is expected to store them with the Studio Runner work item
- **AND** Symphony is expected to pass them to Codex app-server using native `turn/start` model and effort fields
- **AND** Symphony is expected to fall back to `WORKFLOW.md` / configured Codex defaults when execution metadata is absent
- **AND** Symphony is expected to echo requested or applied execution settings in runner event metadata so Studio can render the Runner Log honestly
