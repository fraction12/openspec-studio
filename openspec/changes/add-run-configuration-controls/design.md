# Design: Studio Runner repo runner settings

## Product shape
The Runner tab should read as:

1. **Repo Runner Settings** at the top of the main workspace.
2. **Runner Log** below it.
3. **Runner status/lifecycle/configuration** in the inspector.

The current explanatory cards above the log should be removed or compressed into helper copy inside the settings panel. They should not compete with the log or duplicate inspector status.

## Settings
Initial settings:

- **Model**
  - Default value: `Symphony default`
  - Explicit choices should map to supported Codex model IDs or stable aliases.
  - If Studio cannot discover options yet, ship with a small curated list and preserve a clear default state.

- **Effort**
  - Default value: `Default`
  - Explicit choices: `low`, `medium`, `high`, and any other values Studio deliberately supports after confirming Codex support.

Both settings apply to future Studio-managed runner dispatches for the active repository. They are repo runner defaults, not one-off controls for the selected change.

## State model
Preferred v1:

- Store repo-scoped runner settings in app-local state.
- Defaults mean “let Symphony use its configured defaults.”
- Explicit selections are serialized as requested execution metadata on future Studio Runner dispatch events.
- Historical log rows remain immutable when settings change.
- Runner events/log rows should show the requested model/effort when those values were included in the event or echoed by Symphony.

## Dispatch contract
Studio should keep the main payload thin and change-scoped, but `build.requested` may include a small optional execution object for repo-default execution preferences.

Example shape:

```json
{
  "type": "build.requested",
  "data": {
    "repoPath": "/path/to/repo",
    "change": "introduce-studio-runner",
    "execution": {
      "model": "gpt-5.5",
      "effort": "high"
    }
  }
}
```

Rules:

- Omit `execution` entirely when both settings are defaults.
- Omit individual fields that are still default.
- Only serialize values from Studio's approved option set.
- Treat payload execution settings as requested repo defaults for that dispatch, not as arbitrary user-provided command text.
- Continue signing the raw event body exactly as sent.

## Symphony contract
Symphony should remain responsible for execution. For this settings path, the expected receiver behavior is:

- Parse optional `data.execution.model` and `data.execution.effort`.
- Normalize and validate those values against the supported/allowed set.
- Store them on the Studio Runner work item.
- Forward them to Codex app-server on `turn/start`, using Codex's native `model` and `effort` fields.
- Fall back to `WORKFLOW.md` / configured Codex defaults when execution metadata is absent.
- Echo requested/applied execution settings in events/presenter payloads so Studio can render the log honestly.

This avoids rewriting `WORKFLOW.md`, mutating `codex.command`, or requiring process-level env overrides just to change repo-default model/effort selections.

## Runner lifecycle semantics
Changing repo settings does not require Studio to restart the runner purely for model/effort, because the values are applied at dispatch/turn-start time.

- Saved settings apply to the next explicit dispatch.
- An already-running dispatch keeps the settings it was launched with.
- Historical log rows remain immutable.
- Runner restart may still be required for unrelated runner-level configuration, endpoint, binary, or secret changes.

## UI constraints
- Do not show runner reachability/status cards in the main pane; that belongs in the inspector.
- Do not remove the Runner Log.
- Use existing card/panel/form-control styles.
- Make it obvious the settings affect future Studio-managed runner work for this repository, not past log rows and not only the currently selected change.
