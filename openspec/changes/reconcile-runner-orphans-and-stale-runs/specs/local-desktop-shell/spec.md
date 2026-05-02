# local-desktop-shell Specification Delta

## MODIFIED Requirements
### Requirement: Local Studio Runner workspace
The desktop shell SHALL provide Studio Runner as a first-class workspace-level surface, separate from selected change details, for local runner configuration, lifecycle, status, event streaming, execution-log inspection, setup diagnostics, and a repo-wide Runner Log.

#### Scenario: Existing local runner listener is recovered
- **GIVEN** the configured Studio Runner endpoint is localhost-only
- **AND** a local listener is already bound to that endpoint's port
- **WHEN** Studio checks Runner status or opens the Runner workspace
- **THEN** Studio SHALL inspect whether the listener matches the expected Studio Runner for the active repository
- **AND** when it matches, Studio SHALL show the runner as recovered or already running instead of offline
- **AND** Studio SHALL expose lifecycle controls appropriate to the recovered runner.

#### Scenario: Existing local runner listener is recovered after app restart
- **GIVEN** Studio previously started a local Studio Runner listener
- **AND** the Studio app has been closed and reopened so the in-memory session secret is no longer configured
- **WHEN** Studio checks Runner status for the configured localhost endpoint
- **THEN** Studio SHALL still inspect the endpoint and local listener process
- **AND** when the listener matches the expected Studio Runner for the active repository, Studio SHALL show a yellow "Restart runner" status instead of requiring Start runner first
- **AND** Studio SHALL explain in the Runner inspector that the existing local Studio Runner must be restarted to fix the session secret mismatch
- **AND** Studio SHALL keep Build with agent unavailable until the runner is restarted with the current app session secret.

#### Scenario: Custom user-managed runner is status-only
- **GIVEN** the configured Studio Runner endpoint reaches a compatible custom or user-managed runner
- **WHEN** Studio checks Runner status or opens the Runner workspace
- **THEN** Studio SHALL show the runner reachability and user-facing guidance
- **AND** Studio SHALL NOT expose Stop or Restart as process-termination actions for that custom/user-managed runner in this change.

#### Scenario: Non-matching process owns the runner port
- **GIVEN** the configured Studio Runner port is already occupied by a process that does not match the expected Studio Runner for the active repository or configured custom runner
- **WHEN** Studio checks Runner status or tries to start the runner
- **THEN** Studio SHALL report that the port is occupied by a non-matching process
- **AND** Studio SHALL NOT terminate that process automatically
- **AND** Studio SHALL guide the user to stop the process or choose another endpoint.

#### Scenario: Stop runner handles recovered matching listener
- **GIVEN** Studio has lost its in-memory child-process handle
- **AND** a matching Studio Runner listener is still running for the active repository
- **WHEN** the user activates Stop runner
- **THEN** Studio SHALL stop that matching listener using guarded process termination
- **AND** Studio SHALL update Runner status so the endpoint is no longer reported as running.

#### Scenario: Restart runner replaces stale matching listener
- **GIVEN** a matching Studio Runner listener is already bound to the configured port
- **WHEN** the user activates Restart runner
- **THEN** Studio SHALL stop the matching stale listener before starting a new managed runner with the current session secret
- **AND** Studio SHALL refuse to replace non-matching listeners.
