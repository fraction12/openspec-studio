# Design: Runner ownership recovery and stale-run reconciliation

## Problem
Studio currently treats runner ownership as mostly in-memory. If Studio starts the runner and later reloads, crashes, or loses the child handle, the runner process can survive as a child of `launchd` while still listening on the configured localhost port.

Separately, Studio persists Runner Log rows. If the last event for a repo/change is `running` and Studio never receives a terminal stream event, the selected change can remain locked even when Symphony's current state has no matching active run.

## Product decisions
- **Stale build unlock:** auto-terminalize only when Studio has positive evidence that no matching active run remains. Unknown runner truth stays pending and visible.
- **Custom/user-managed runners:** expose reachability and guidance only. Studio does not stop or restart custom/user-managed runners in this change.
- **Terminal state naming:** use first-class local `stale` for proven-stale Runner Log rows.
- **MVP truth source:** use health, stream, guarded process inspection, and explicit Studio stop/restart evidence now. Defer a dedicated active-run endpoint.

## Research notes
- Rust `std::process::Child` does not terminate or wait automatically when the handle is dropped, so long-running applications must explicitly manage child process exit and reaping. This supports treating orphaned listener recovery as a real lifecycle bug.
- Tauri sidecar/process documentation frames local child processes as explicit spawn/permission/lifecycle work, so Studio should model ownership rather than assuming an online localhost listener is always Studio-managed.
- WCAG/WAI-ARIA status guidance supports visible, programmatically legible status updates for application state, progress, and errors. Runner recovery, occupied ports, disconnected streams, and stale terminalization should be exposed as status/log copy rather than silent state changes.

## Ownership model
Studio should classify the configured endpoint/port into one of these states:

- **Not listening**: no process owns the configured port.
- **Managed**: Studio has an in-memory process handle or recovered matching process snapshot.
- **Recovered**: a matching Studio Runner listener exists for the expected repo/endpoint but Studio did not start it in this app session.
- **Custom/user-managed**: a compatible local runner is reachable but Studio should not assume process ownership.
- **Occupied/non-matching**: the port is held by something that is not the expected Studio Runner for this repo/endpoint.

For process-level actions, Studio may only stop or replace listeners that match the expected Studio Runner command/repo/endpoint. Non-matching listeners must produce guidance, not termination.

Custom/user-managed listeners are intentionally status-only for this bug fix. Studio may report that the compatible runner is reachable, but Stop and Restart must not terminate or replace it unless a later spec defines explicit user-managed ownership identity and consent.

## Recovery behavior
When Studio checks runner status, starts the event stream, or opens the Runner workspace, it should inspect the configured endpoint and local listener process when possible.

If a matching listener exists, Studio should surface it as recoverable/running and expose stop/restart controls. The copy should say Studio found an existing local Studio Runner rather than implying the user started it in the current session.

If a non-matching listener exists, Studio should show that the port is occupied and require the user to stop that process or choose another endpoint.

## Stop/restart behavior
Stop runner should stop the known managed process. If the process handle is missing but a matching recovered listener is present, Stop runner should terminate that matching listener with the same safety checks used by Restart runner.

Restart runner should replace a matching stale listener before starting a fresh Studio-managed runner with the current session secret.

## Stale run reconciliation
Studio should not rely solely on persisted `running` rows for Build button locks.

When runner status or stream reconciliation proves there is no active matching run for a persisted `accepted` or `running` row, Studio should terminalize that local row as `stale` and unlock the change.

Signals that can prove stale state include:

- the runner is offline or stopped and Studio has no active stream;
- the stream reconnect/snapshot contains no matching active run after reconnect, when the runner provides that evidence;
- the matching workspace/marker is absent when available evidence says the run cannot still be executing.
- the user explicitly stops or restarts the matching managed/recovered Studio Runner from Studio.

This reconciliation should be conservative: if runner state is unknown, Studio may keep the row pending and show uncertainty. It should only unlock when it has positive evidence that no matching run is active or when the user explicitly stops the matching runner from Studio.

A dedicated Symphony active-run/state endpoint would make reconciliation stronger, but it is not required for this MVP bug fix.

## UI copy
The Runner workspace should make the state legible:

- “Runner already running” / “Recovered local runner” for matching orphaned listeners.
- “Custom runner reachable” for compatible status-only custom/user-managed listeners.
- “Port occupied by another process” for non-matching listeners.
- “Run marked stale after runner stopped” for terminalized local rows.

The selected change inspector should stop showing **Building…** once the matching run row has been terminalized.

## Safety
Studio must not kill arbitrary processes. Listener termination is allowed only when process inspection matches the expected Studio Runner binary/command and expected repo path for a managed or recovered Studio Runner.

Technical diagnostics may include PID, endpoint, repo path, and command path, but secrets, signatures, tokens, and environment variables must remain redacted.

## Rejected approaches
- **Manual-only stale clearing:** rejected because it leaves the main workflow blocked when Studio has enough evidence to recover automatically.
- **Time-based auto-timeout:** rejected because a long-running legitimate build could be incorrectly unlocked.
- **Overload cancelled/failed:** rejected because stale is local reconciliation state, not runner intent or execution failure.
- **Require a new active-run endpoint first:** rejected for MVP because health, stream, process, and explicit stop/restart evidence can fix the known bug without expanding the runner API.
