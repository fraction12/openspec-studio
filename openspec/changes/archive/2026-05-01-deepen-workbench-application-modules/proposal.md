## Why

OpenSpec Studio has deepened several core Modules, but `src/App.tsx` is still carrying too much repository workflow, navigation, table interaction, artifact detail, and runner log policy. This makes behavior harder to test at the Interface where bugs actually occur and forces maintainers to bounce between the app shell, domain helpers, persistence, provider operations, and runner coordination for one conceptual change.

## What Changes

- Introduce a Workbench Application Modules architecture change that deepens five shallow areas behind explicit, behavior-preserving Module Interfaces:
  - Repository Opening Flow Module
  - Workspace Navigation State Module
  - Board Table Interaction Module
  - Artifact Detail View-Model Module
  - Studio Runner Log Module
- Move state-transition and derivation policy out of the React app shell when that policy belongs to a reusable domain or workflow Module.
- Keep React responsible for rendering, event wiring, and visual composition.
- Preserve current product behavior, visible copy, persistence formats, Tauri command names, OpenSpec provider behavior, and Studio Runner dispatch payloads.
- Add focused tests around the new Module Interfaces so future behavior changes do not require importing the app shell or building large React harnesses.
- Update domain vocabulary so future architecture work can discuss these Modules consistently.

## Capabilities

### New Capabilities
- `workbench-application-modules`: Defines deep Module ownership for repository opening, workspace navigation, board table interactions, artifact detail modeling, and runner log policy in the app shell.

### Modified Capabilities
- `workspace-view-model`: Clarifies that workspace projection remains the source data model while navigation and selected artifact detail are modeled by adjacent Modules rather than React-only helpers.
- `studio-runner-session`: Clarifies that Runner operational coordination remains in Studio Runner Session while runner history/log policy is owned by a dedicated Studio Runner Log Module.

## Impact

- Affected code: `src/App.tsx`, `src/appModel.ts`, `src/persistence.ts`, `src/domain/boardTableModel.ts`, `src/domain/workspaceViewModel.ts`, `src/providers/providerSession.ts`, `src/runner/studioRunnerSession.ts`, and related tests.
- No external API, Tauri command, persistence shape, dependency, or product workflow changes are intended.
- The expected implementation outcome is smaller app-shell orchestration, more direct unit tests, and better locality for repository lifecycle, navigation, table, artifact detail, and runner log regressions.
