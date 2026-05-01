# Disable Build with agent while selected change is running

## Why
The selected-change inspector can still present **Build with agent** as an available action while Studio Runner already has an active run for that same repository/change. That is confusing and invites duplicate clicks even though the runner side already prevents duplicate in-flight work.

The UI should make the in-progress state obvious: if the selected change is currently being built by an agent, the button should be disabled and read **Building...** with a lightweight animated ellipsis.

## What changes
- Detect whether the selected active change has an in-flight Studio Runner run for the current repository/change pair.
- Disable the inspector **Build with agent** action while that specific change is already running.
- Change the button label to **Building...** for that selected change.
- Animate only the ellipsis in a simple, non-distracting loop.
- Preserve existing eligibility blockers and dispatch behavior for changes with no active run.

## Out of scope
- Changing runner dispatch/signing semantics.
- Changing Symphony capacity or duplicate-run enforcement.
- Adding a queue or automatic retry behavior.
- Disabling all change actions when another change is running.
- Replacing the Runner Log as the source of detailed runner state.
