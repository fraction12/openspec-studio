## Why

OpenSpec Studio currently derives project truth from live OpenSpec files, which is correct, but the app still needs a small amount of convenience memory to feel like a real desktop tool. Recent repositories, last selected repo, table preferences, selection state, and validation snapshots should survive restarts without becoming a second source of truth.

## What Changes

- Add a lightweight local persistence layer for app-owned convenience state.
- Persist recent repositories and reopen the last selected repo when it still exists.
- Persist per-repo UI state such as selected change/spec and table sort direction.
- Persist validation snapshots only with a file fingerprint/signature so cached validation can be shown as current only when the repository has not changed.
- Store app preferences needed for the current inspection-window experience, while keeping broader settings-page scope separate.
- Make all persisted derived state disposable and rebuildable from OpenSpec files plus CLI output.

## Capabilities

### New Capabilities
- `local-app-persistence`: App-local convenience persistence for recent repos, selected repo, per-repo UI state, preferences, and fingerprinted validation snapshots.

### Modified Capabilities
- `local-desktop-shell`: Launch and repo-selection behavior should use persisted recent/last repo state.
- `change-board`: Table sort and selected change/spec state may be restored from app-local persistence.
- `validation-dashboard`: Cached validation snapshots may be restored only with staleness/fingerprint checks.

## Impact

- Tauri-side storage bridge or store plugin integration.
- Frontend app model for serializing/deserializing safe app state.
- Repo fingerprinting/file-signature logic reused or extended from existing OpenSpec file signatures.
- UI copy for stale validation snapshots and missing/moved repositories.
- Tests for persistence shape migration, path validation, stale validation behavior, and corrupted-store recovery.

## Non-Goals

- Do not copy or persist OpenSpec artifacts as canonical data.
- Do not persist task completion, archive readiness, or validation health as truth without checking the current file signature.
- Do not introduce SQLite/search index storage yet.
- Do not build a full settings page as part of this change.
- Do not require persistence for the app to function; it should fail open with fresh derived state if persistence is unavailable or corrupt.
