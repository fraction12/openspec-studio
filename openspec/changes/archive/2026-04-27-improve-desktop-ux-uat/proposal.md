## Why

UAT showed that OpenSpec Studio now reads the right data, but the product still makes users behave like developers: typing absolute paths, interpreting stale validation states, recovering from bad inputs manually, and tolerating inspector panels that feel cramped or out of sync. This change raises the desktop experience to product quality by making repository onboarding native, preserving trust during errors, and tightening layout, hierarchy, and terminology across the app.

## What Changes

- Replace path-first repository opening with a native folder picker as the primary flow while keeping manual path entry as an advanced fallback.
- Restore the last successful repository on launch and present recent repositories as a real switcher with the current repo highlighted.
- Preserve the last valid workspace when a new path fails, and provide recovery actions such as choosing another folder, retrying, or returning to the last repo.
- Make empty, no-workspace, invalid-path, loading, and validation states actionable and understandable to non-CLI users.
- Keep table/list selection synchronized with active filters, phases, and view changes so inspectors never feel detached from visible rows.
- Refine the change and spec inspectors with consistent gutters, scroll behavior, tab alignment, metadata hierarchy, and non-redundant detail presentation.
- Improve the specs page so users learn more as they drill in: overview table first, then spec identity, health, requirements, summary quality, validation links, and file actions.
- Clarify action labels and status language, including the difference between refresh, validation, stale state, not-run state, and unknown attention.
- Remove or suppress redundant helper text, repeated status information, and placeholder content that makes the app feel unfinished.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `local-desktop-shell`: Native desktop repository opening, launch recovery, global layout chrome, and desktop action affordances become part of the shell contract.
- `repo-discovery`: Repository selection, recents, invalid-path handling, no-workspace recovery, and selected-repository preservation become product requirements.
- `change-board`: Filter/phase selection synchronization, drill-down hierarchy, inspector layout, row affordances, and artifact action clarity become board/detail requirements.
- `validation-dashboard`: Validation copy, trust state, stale/not-run/unknown semantics, and refresh-vs-validate action clarity become validation requirements.
- `workspace-intelligence`: Specs browsing and spec detail drill-down become explicit requirements for moving from overview to deeper derived information.

## Impact

- React/Tauri app shell and bridge integration for native folder selection.
- Sidebar repository selector, recents, invalid-path/no-workspace/loading states, and app launch restoration.
- Change/spec board filtering, selection, inspector state, and action labels.
- Validation state model and display copy for not-run, stale, pass, fail, command failure, and unknown attention.
- CSS/layout system for shell columns, side panel gutters, scroll gutters, tabs, tables, status band, buttons, inputs, and empty states.
- Tests for repo selection state preservation, recent path behavior, selection synchronization, validation labels, and derived UI state.
