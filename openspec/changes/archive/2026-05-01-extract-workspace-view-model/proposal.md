## Why

The OpenSpec indexer is already a deep module, but the next projection layer lives inside `App.tsx`. Keeping archive readiness, build status, validation mapping, summaries, timestamps, and search text in the app shell makes the shell harder to understand and forces view-model tests to import the whole app.

## What Changes

- Extract workspace view projection into a dedicated Workspace View-Model module.
- Keep the existing rendered behavior and data shape stable for changes, specs, archived changes, artifacts, and validation-derived status.
- Move focused view-model tests away from the app shell import path.
- Add domain vocabulary for Workspace View-Model.

## Capabilities

### New Capabilities

- `workspace-view-model`: Internal projection contract from indexed OpenSpec workspace data to UI-ready workspace records.

### Modified Capabilities

None.

## Impact

- Affected frontend modules: `src/App.tsx`, workspace view-model extraction, and existing view-model tests.
- No new runtime dependencies.
- No intended behavior changes, OpenSpec file mutations, or UI copy changes.
