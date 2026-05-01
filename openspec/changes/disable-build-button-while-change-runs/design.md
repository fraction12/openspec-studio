# Design: selected-change running state

## Current behavior
Studio already tracks Studio Runner dispatch attempts and stream updates in local app state. Symphony emits run status updates keyed by event/run identity and repository/change metadata. The selected-change inspector receives dispatch eligibility plus a coarse busy flag, and currently renders **Dispatching...** only while the local dispatch request is in progress.

That local busy flag is not the same as a runner already building the selected change. Once the runner accepts and starts work, the request can finish while the agent continues running. The inspector should reflect the longer-lived run state.

## Running-change detection
Studio should derive a selected-change running flag from current Runner Log / runner dispatch state rather than a separate ad hoc flag.

A selected change is considered building when:

- repository path matches the open repository;
- change name matches the selected change;
- the row/event represents an actual run/dispatch for that repository/change;
- the latest known status is in-flight, such as `accepted` or `running`.

Terminal or non-blocking states are not building:

- `completed`
- `blocked`
- `failed`
- `conflict`
- local lifecycle/stream/diagnostic rows

If status is unknown, Studio should not assume the change is building unless the current local dispatch request is still busy.

## Inspector button behavior
The inspector action should prioritize states in this order:

1. local dispatch request in progress: disable and show **Dispatching...** or the existing dispatch-progress copy;
2. selected change already has an in-flight runner run: disable and show **Building...**;
3. normal eligibility blockers: disable with existing unavailable reason;
4. eligible: enable and show **Build with agent**.

The selected-change running state should disable only the selected change's Build action. It should not prevent the user from selecting other changes, viewing logs, expanding run details, stopping/restarting the runner, or dispatching another eligible change if runner capacity and policy allow it.

## Animated ellipsis
The **Building...** label should animate only the dots:

- simple loop through `Building.`, `Building..`, `Building...` or an equivalent CSS-only reveal;
- no layout shift as the dot count changes;
- respect reduced-motion preferences by showing a static **Building...** label;
- do not animate the entire button or create spinner noise.

## Data source
Prefer the same normalized runner model used by the Runner Log and Studio Runner Session. This keeps the button consistent with what the Runner workspace shows and avoids duplicating Symphony-specific logic in the inspector.

If the runner stream is disconnected but the latest local state still says the selected change is in-flight, Studio may continue showing **Building...** until a terminal update, manual refresh, or explicit user action resolves the run state.
