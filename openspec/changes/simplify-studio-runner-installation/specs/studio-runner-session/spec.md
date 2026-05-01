# studio-runner-session Specification Delta

## MODIFIED Requirements
### Requirement: Runner session state
Studio SHALL normalize local Studio Runner lifecycle, dispatch, event stream, setup, and run metadata into a bounded session model.

#### Scenario: Runner setup readiness is represented in session state
- **GIVEN** Studio has checked runner setup prerequisites
- **WHEN** it updates Studio Runner session state
- **THEN** the session model SHALL represent setup status, blocking diagnostics, advisory diagnostics, runner identity, runner version/protocol when available, endpoint, and managed/custom mode.

#### Scenario: Runner health metadata is preserved
- **GIVEN** the runner health endpoint returns product, version, protocol, capability, signing, or readiness metadata
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
