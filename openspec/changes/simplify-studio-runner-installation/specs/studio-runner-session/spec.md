# studio-runner-session Specification Delta

## MODIFIED Requirements
### Requirement: Runner session state
Studio SHALL normalize local Studio Runner lifecycle, dispatch, event stream, setup, compatibility, diagnostics, and run metadata into a bounded session model.

#### Scenario: Runner setup readiness is represented in session state
- **GIVEN** Studio has checked runner setup prerequisites
- **WHEN** it updates Studio Runner session state
- **THEN** the session model SHALL represent setup status, blocking diagnostics, advisory diagnostics, runner identity, runner version/protocol when available, endpoint, and managed/custom mode.

#### Scenario: Managed runner install/update state is represented
- **GIVEN** Studio manages the local runner sidecar
- **WHEN** it discovers, installs, updates, starts, or checks the sidecar
- **THEN** the session model SHALL represent whether the runner is absent, installable, installing, installed, updating, ready, running, stale, incompatible, or failed
- **AND** it SHALL preserve enough non-sensitive technical detail for troubleshooting.

#### Scenario: Runner health metadata is preserved
- **GIVEN** the runner health endpoint returns product, implementation, version, protocol, capability, signing, or readiness metadata
- **WHEN** Studio records runner status
- **THEN** Studio SHALL preserve that metadata in normalized state so the UI can show compatibility and capability decisions without reparsing raw responses.

#### Scenario: Diagnostics separate user message from technical detail
- **GIVEN** a setup or readiness check fails
- **WHEN** Studio records the diagnostic
- **THEN** each diagnostic SHALL include a user-facing summary and may include expandable technical detail
- **AND** sensitive values such as secrets, signatures, tokens, auth headers, and environment values SHALL NOT be stored in diagnostics.

#### Scenario: Custom runner mode is visible
- **GIVEN** the user configures a custom runner path or endpoint
- **WHEN** Studio records runner session state
- **THEN** the session model SHALL indicate that the runner is custom/user-managed
- **AND** Studio SHALL continue to record compatibility, health, event stream, and dispatch readiness separately from that mode label.

#### Scenario: Dispatch readiness combines setup and change eligibility
- **GIVEN** a selected change is otherwise eligible for dispatch
- **WHEN** runner setup has blocking diagnostics
- **THEN** Studio SHALL keep **Build with agent** disabled
- **AND** the session model SHALL expose the setup blockers needed for the UI to explain why dispatch is unavailable.
