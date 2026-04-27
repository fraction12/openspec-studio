## Why

Archived changes currently appear as empty, active-style records in OpenSpec Studio even though their archived proposal, design, and task files still exist on disk. This makes the archived page feel broken and hides useful historical context.

## What Changes

- Treat archived changes as read-only historical records derived from `openspec/changes/archive/<archived-change>/`.
- Show archived proposal, design, tasks, and spec delta files when they exist.
- Label archived rows as `Archived` instead of implying active validation status.
- Remove active-only validation and archive-readiness surfaces from archived change detail panels.
- Add lightweight archive metadata so users can understand the archived folder, date, original slug, and available files.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-board`: Archived rows and detail panels become first-class historical views with real artifact previews and archive-specific actions.
- `workspace-intelligence`: Archived change records are derived from archived OpenSpec files instead of placeholder records.

## Impact

- React/Tauri app model for archived change indexing and view conversion.
- Archived change inspector tab logic, table labels, artifact actions, and archive info rendering.
- Tests for archived artifact discovery, task progress, summary derivation, and archived-only UI behavior.
