## Why

OpenSpec Studio already has app-local behavior that affects user trust and daily workflow: last-repo restore, recent repositories, per-repo selection and sort continuity, background refresh, validation snapshots, and stored diagnostics. Some of that behavior is visible only indirectly, and some persisted state can only be changed by clearing app data outside Studio.

The settings change should give users control over those existing behaviors without turning Settings into a wishlist for unbuilt product areas. A setting is in scope only when it controls behavior or data that already exists in the app, or behavior delivered by another accepted active change.

## What Changes

- Add a dedicated app settings surface reachable from the main shell.
- Group settings by scope: app-wide behavior, current repository continuity, local data/privacy, and implemented feature-specific integrations.
- Surface controls for existing behavior:
  - auto-reopen of the last successful repository on launch;
  - automatic background refresh of the active repository;
  - recent repository management;
  - current-repository UI continuity reset for selection and table sort state;
  - validation snapshot and diagnostic cache clearing;
  - theme/density preferences only if the shell applies them immediately.
- Keep Settings local-first: preferences and data management use app-local persistence and never modify OpenSpec project files.
- Avoid dormant or speculative controls. Studio Runner now exists, so Settings should include real global Runner configuration controls while provider, graph, timeline, and guided-workflow settings remain hidden until those capabilities expose real configuration.

## Capabilities

### New Capabilities

- `app-settings`: App settings navigation, scoping, persistence, and local data controls.

### Modified Capabilities

- `local-app-persistence`: Settings can mutate and clear app-owned convenience state without changing repository files.
- `local-desktop-shell`: The shell exposes Settings as a global surface while preserving the current workspace context.

## Impact

- Frontend settings page/panel and navigation affordance.
- Persistence model additions for user-controlled app behavior and global Runner defaults, plus helper operations for clearing recent repositories, repo UI state, and validation snapshots.
- Tests for settings persistence, clearing behavior, launch restore behavior, auto-refresh gating, and no-op behavior outside Tauri where applicable.
- Coordination with active changes:
  - `introduce-studio-runner` now contributes real Runner behavior, so Settings should host global Runner defaults such as model and effort while operational lifecycle remains in the Runner workspace.
  - `introduce-openspec-provider-adapter` may later contribute provider selection or adapter controls, but this change should not expose provider management while OpenSpec is the only shipped provider.

## Open Questions

- Should Settings replace the workbench content area while open, or appear as a right-side/global panel?
- Should clearing validation snapshots support current repo first, all repos, or both?
- Should theme/density controls be part of the first implementation if they require visual application work, or should they remain hidden until the existing persisted fields are wired into the shell?
- Which curated model aliases should ship as the initial global Runner default options before Studio can discover them from Symphony/Codex?
