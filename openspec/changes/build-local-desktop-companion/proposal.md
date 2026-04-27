## Why

OpenSpec is becoming the project planning and change-tracking layer across local repositories, but its current interface is CLI-first. A local visual companion would make it much easier to understand active changes, spec coverage, artifact status, and validation health across a repo without running ad hoc commands or opening folders manually.

This should be a proper standalone local app, not another web dev server. The CLI remains the source of truth; the app gives a visual operating layer over the existing `openspec/` workspace.

## What Changes

- Add a standalone desktop application, tentatively **OpenSpec Studio**, that can open any local repository containing an `openspec/` directory.
- Provide a repo picker and recent-repos flow for switching between local projects.
- Read OpenSpec changes, specs, artifacts, tasks, and validation state from the selected repo.
- Show a visual change board for active and archived changes, grouped by state and health.
- Show per-change detail views for proposal, design, tasks, delta specs, touched capabilities, and archive readiness.
- Surface validation errors and missing/incomplete artifacts without replacing the OpenSpec CLI.
- Prefer direct file reads plus `openspec` CLI JSON commands for compatibility with the existing format.
- Keep the app local-first: no cloud sync, no accounts, no daemon requirement, and no `npm run dev` workflow for normal use.

## Capabilities

### New Capabilities
- `local-desktop-shell`: standalone local app behavior, repo selection, recent repos, filesystem access, and CLI execution boundaries.
- `repo-discovery`: detection and indexing of a selected repo's OpenSpec workspace, including specs, changes, artifacts, tasks, and archive folders.
- `change-board`: visual overview of changes, artifact completeness, touched capabilities, task progress, and archive readiness.
- `validation-dashboard`: validation execution, result parsing, error display, and stale-state refresh behavior.

### Modified Capabilities

None. This is a new product surface.

## Impact

- New app repository under `/Volumes/MacSSD/Projects/openspec-studio`.
- New desktop app shell, likely Tauri for v1 unless a later design decision chooses native Swift.
- Local filesystem reads for selected repositories.
- Integration with the installed `openspec` CLI, especially JSON commands such as `list`, `show`, `status`, and `validate`.
- File watching for refresh after OpenSpec artifacts change.
- No changes to the OpenSpec file format or CLI behavior are required for the initial version.
