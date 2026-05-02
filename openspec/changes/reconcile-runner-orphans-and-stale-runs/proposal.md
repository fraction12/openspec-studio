# Reconcile Studio Runner orphan processes and stale runs

## Why
Studio Runner currently has two coupled failure modes that make the product feel haunted:

1. A Symphony/Studio Runner listener can remain alive on the configured port after Studio loses its in-memory process handle, so the port is online even though the user has not clicked **Start runner** in the current app session.
2. Studio can persist a `running` Runner Log row after the runner stops, restarts, or loses its stream before a terminal event arrives, leaving the selected change locked behind **Building…** even when Symphony has no active run.

Both cases break the user mental model: Start runner should explain why a runner is listening, Stop runner should be able to stop matching Studio Runner listeners, and Build with agent should not stay disabled forever because of stale client state.

## What changes
- Teach Studio to distinguish managed, recovered, orphaned/matching, custom/user-managed, and non-matching listeners on the configured runner port.
- Recover or surface matching Studio Runner listeners found by endpoint/process inspection instead of pretending the runner is offline.
- Let users stop or restart a matching orphaned Studio Runner listener from Studio.
- Reconcile persisted `running`/`accepted` run rows against runner state only when health, stream, process, or stop evidence proves no active matching run remains.
- Mark stale local run rows terminal with a clear first-class `stale` state and unlock the selected change.
- Treat compatible custom/user-managed runners as status-only from Studio unless a later change defines an explicit ownership identity.
- Keep non-matching processes safe: never kill arbitrary listeners that do not look like the expected Studio Runner for the active repo/endpoint.

## Selected product direction
- Use conservative auto-unlock: Studio terminalizes stale rows only with positive no-active-run evidence.
- Keep custom/user-managed runners status-only: Studio may show reachability and guidance, but it SHALL NOT stop or restart them in this change.
- Add `stale` as the local terminal state for proven-stale rows instead of overloading cancelled or failed.
- Use current MVP truth sources: runner health checks, event stream reconnect/snapshots when available, guarded process inspection, and explicit Studio stop/restart actions. A dedicated active-run endpoint is deferred.

## Out of scope
- Changing signed dispatch semantics.
- Changing Symphony's execution/publication lifecycle.
- Adding a cloud runner or remote runner process manager.
- Killing non-matching processes on occupied ports.
- Stopping or replacing custom/user-managed runners from Studio.
- Requiring a new Symphony active-run/state endpoint for this bug fix.
- Replacing the broader managed setup/checklist work in `simplify-studio-runner-installation`.

## Impacted specs
- `local-desktop-shell`: runner lifecycle, port/listener ownership, stop/restart behavior, and user-facing recovery states.
- `studio-runner-session`: normalized runner ownership state and stale run reconciliation policy.
