## Why

OpenSpec Studio has accumulated duplicated labels, paths, and status pills across the header, inspectors, and workspace surfaces. The extra copy makes the app feel noisy and sometimes contradicts the newer build-status and runner-status language.

## What Changes

- Simplify the workspace header to prioritize the repository name, workspace switcher, primary actions, and one runner status pill.
- Remove redundant path, type, status, and file-action controls from Specs and Runner inspectors where the same information is already available elsewhere or does not support the current task.
- Rename Specs table trust language to validation language with `Validate`, `Valid`, and `Invalid` states.
- Rename runner availability states to `Online` and `Offline` internally and in visible UI.
- Remove the manual path entry affordance from the left repository panel.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-board`: Change and spec board surfaces should use concise inspector/header copy and validation-oriented spec status labels.
- `local-desktop-shell`: Workspace header and runner surfaces should use Online/Offline runner state language and remove redundant repository/runner metadata.
- `repo-discovery`: Repository navigation should no longer expose manual path entry in the left panel.

## Impact

- React UI in `src/App.tsx` and supporting styles in `src/App.css`.
- Runner status derivation and UI-facing types in `src/appModel.ts`.
- Unit tests for model/status derivation and UI rendering expectations.
