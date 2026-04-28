## Why

OpenSpec Studio currently surfaces many failures as short-lived status text or conservative row state. When the OpenSpec CLI rejects a change, emits unparseable output, or a file read fails, users need a durable place to inspect what happened instead of wondering whether the app failed silently.

## What Changes

- Preserve failed OpenSpec operation details in app state, including operation type, target, message, exit status, stdout, stderr, and timestamp when available.
- Show a persistent, visible error surface when OpenSpec-backed commands or reads fail.
- Attach contextual operation failures to affected validation views, change rows, archive actions, and artifact previews.
- Keep the implementation lightweight: no persisted history, filtering, or full event-log workflow yet.

## Capabilities

### New Capabilities

### Modified Capabilities
- `local-desktop-shell`: OpenSpec command and file-read failures become durable, inspectable UI state instead of transient messages only.
- `validation-dashboard`: Validation command and parse failures expose actionable details and raw OpenSpec output.
- `change-board`: Archive and per-change status failures are visible in the affected change context.

## Impact

- `src/App.tsx` app state, status band, inspector, and failure handling.
- `src/appModel.ts` helpers for operation failure normalization.
- Existing Vitest coverage for validation, archive readiness, and app model behavior.
- No new runtime dependency or bridge command shape.
