# Design: Studio Runner global settings controls

## Product shape
Settings should be the source of truth for durable Studio Runner configuration. The Runner tab should read as an operational cockpit:

1. **Runner Log** as the primary main-workspace surface.
2. Optional compact helper copy or a summary/link such as “Using global Runner defaults from Settings.”
3. **Runner status/lifecycle/configuration** in the inspector.

The current explanatory cards above the log should be removed or compressed. They should not become a second settings surface or compete with the Runner Log.

## Settings
Initial global settings in Settings > Studio Runner:

- **Model**
  - Default value: `Symphony default`
  - Explicit choices should map to supported Codex model IDs or stable aliases.
  - If Studio cannot discover options yet, ship with a small curated list and preserve a clear default state.

- **Effort**
  - Default value: `Default`
  - Explicit choices: `low`, `medium`, `high`, and any other values Studio deliberately supports after confirming Codex support.

Both settings apply to future Studio-managed runner dispatches globally. They are global Runner defaults, not one-off controls for the selected change and not per-repository overrides in v1.

## State model
Preferred v1:

- Store global Runner defaults in app-local state.
- Defaults mean “let Symphony use its configured defaults.”
- Explicit selections are serialized as requested execution metadata on future Studio Runner dispatch events.
- Historical log rows remain immutable when settings change.
- Runner events/log rows should show the requested model/effort when those values were included in the event or echoed by Symphony.

## Dispatch contract
Studio should keep the main payload thin and change-scoped, but `build.requested` may include a small optional execution object for global execution preferences.

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
- Treat payload execution settings as requested global defaults for that dispatch, not as arbitrary user-provided command text.
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
Changing global Runner settings does not require Studio to restart the runner purely for model/effort, because the values are applied at dispatch/turn-start time.

- Saved settings apply to the next explicit dispatch.
- An already-running dispatch keeps the settings it was launched with.
- Historical log rows remain immutable.
- Runner restart may still be required for unrelated runner-level configuration, endpoint, binary, or secret changes.

## UI constraints
- Do not show runner reachability/status cards in the main pane; that belongs in the inspector.
- Do not remove the Runner Log.
- Use existing Settings form-control styles for durable defaults.
- Make it obvious the settings affect future Studio-managed runner work globally, not past log rows and not only the currently selected change.
- If the Runner workspace references defaults, it should link users back to Settings rather than duplicating editable controls.
