## Why

OpenSpec Studio already has app-local behavior that affects user trust and daily workflow: last-repo restore, recent repositories, per-repo selection and sort continuity, background refresh, validation snapshots, and stored diagnostics. Some of that behavior is visible only indirectly, and some persisted state can only be changed by clearing app data outside Studio.

The settings change should give users control over those existing behaviors without turning Settings into a wishlist for unbuilt product areas. A setting is in scope only when it controls behavior or data that already exists in the app, or behavior delivered by another accepted active change.

## What Changes

- Add a dedicated app settings surface reachable from a global Settings entry pinned at the bottom of the left panel.
- Group settings by scope: app-wide behavior, current repository continuity, local data/privacy, and implemented feature-specific integrations.
- Surface controls for existing behavior:
  - auto-reopen of the last successful repository on launch;
  - automatic background refresh of the active repository;
  - recent repository management;
  - current-repository UI continuity reset for selection and table sort state;
  - validation snapshot and diagnostic cache clearing;
  - theme/density preferences only if the shell applies them immediately.
- Keep Settings local-first: preferences and data management use app-local persistence and never modify OpenSpec project files.
- Avoid dormant or speculative controls. Studio Runner now exists, so Settings should include real global Runner execution defaults while provider, graph, timeline, and guided-workflow settings remain hidden until those capabilities expose real configuration.
- Keep the Studio Runner endpoint on the Runner page for this pass; Settings owns durable execution defaults, not live connection/lifecycle controls.

## Capabilities

### New Capabilities

- `app-settings`: App settings navigation, scoping, persistence, and local data controls.

### Modified Capabilities

- `local-app-persistence`: Settings can mutate and clear app-owned convenience state without changing repository files.
- `local-desktop-shell`: The shell exposes Settings as a global surface while preserving the current workspace context.

## Impact

- Frontend settings page and left-panel navigation affordance.
- Persistence model additions for user-controlled app behavior and global Runner defaults, plus helper operations for clearing recent repositories, repo UI state, and validation snapshots.
- Tests for settings persistence, clearing behavior, launch restore behavior, auto-refresh gating, and no-op behavior outside Tauri where applicable.
- Coordination with active changes:
  - `introduce-studio-runner` now contributes real Runner behavior, so Settings should host global Runner execution defaults such as model and effort while endpoint, session, stream, and operational lifecycle remain in the Runner workspace.
  - `introduce-openspec-provider-adapter` may later contribute provider selection or adapter controls, but this change should not expose provider management while OpenSpec is the only shipped provider.

## Decisions

- Settings should replace the main workbench content area while open, preserving the active repository, board, selection, filters, and inspector state for return.
- The Settings navigation button should live at the bottom of the left panel because these are global app settings rather than repository-board controls.
- Clearing validation snapshots should support both current repository and all repositories.
- Theme/density controls stay hidden in the first implementation unless the shell applies them immediately.
- Runner endpoint stays on the Runner page for now.
- Runner execution defaults are real v1 settings: Settings should expose effort defaults as `Default`, `Low`, `Medium`, and `High`, and model defaults as `Default` plus an optional custom model id instead of a curated model list.
- Destructive local-data actions should use inline two-step confirmation on the affected row instead of modal dialogs or undo stacks.
- Settings should ship as a single scrollable page grouped by scope, not as nested settings navigation.
- Resetting current-repository continuity should clear persisted selection and sort state while keeping the current in-memory workspace stable until reload or explicit navigation.

## Open Questions

- None for this pass. Curated model discovery can be revisited when Studio Runner or Codex exposes a reliable model catalog.
