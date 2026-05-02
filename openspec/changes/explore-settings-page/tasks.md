## 1. Settings Scope And Navigation

- [x] 1.1 Add a global Settings entry pinned to the bottom of the left panel without disrupting repository selection, board state, or inspector state.
- [x] 1.2 Implement a dedicated Settings surface that replaces the main workbench content area with app-wide, repositories, current-repository, validation/diagnostics, and implemented integrations groups.
- [x] 1.3 Hide or omit settings for unimplemented capabilities; render Studio Runner settings only for real durable Runner defaults and do not render placeholder provider/graph/timeline controls.
- [x] 1.4 Keep Settings as one scrollable page for the first implementation; do not add nested settings navigation.

## 2. Persistence And Data Controls

- [x] 2.1 Extend normalized global preferences for auto-restore-last-repo and auto-refresh-repository, preserving current defaults.
- [x] 2.2 Add persistence helpers for updating global preferences, forgetting one recent repository, clearing all recent repositories, resetting one repo's UI continuity state, and clearing validation snapshots.
- [x] 2.3 Add Settings actions for recent repository removal and clearing local app-owned repository history.
- [x] 2.4 Add Settings actions for resetting current-repository selection/sort continuity.
- [x] 2.5 Add Settings actions for clearing validation snapshots for the current repository and all repositories.
- [x] 2.6 Add a separate persisted Runner execution defaults shape for model/effort; do not overload endpoint-only Runner connection settings.

## 3. Behavior Wiring

- [x] 3.1 Gate launch-time last repository restore behind the auto-restore setting.
- [x] 3.2 Gate automatic background repository refresh behind the auto-refresh setting while keeping manual refresh available.
- [x] 3.3 Ensure clearing validation snapshots updates the current workspace trust state without modifying OpenSpec files.
- [x] 3.4 Add theme/density controls only if the implementation applies those preferences immediately; otherwise leave them hidden.
- [x] 3.5 Add global Studio Runner model/effort controls in Settings with effort values Default/Low/Medium/High and model values Default/custom model id.
- [x] 3.6 Extend future Studio Runner dispatch requests to include non-default model/effort defaults while keeping endpoint editing, session secret, lifecycle, live status, selected-change dispatch, and Runner Log in the Runner workspace/action surfaces.
- [x] 3.7 Keep the current in-memory selection stable when current-repository continuity is reset; apply the reset to future restoration/reload behavior.
- [x] 3.8 Add inline two-step confirmation for destructive local-data actions with Confirm and Cancel states.

## 4. Verification

- [x] 4.1 Add unit coverage for preference normalization, global Runner defaults, and data-clearing helpers.
- [x] 4.2 Add interaction coverage for settings actions that mutate persisted state.
- [x] 4.3 Verify settings actions do not modify files under the selected repository's `openspec/` directory.
- [x] 4.4 Add interaction coverage for inline confirmation cancel/confirm flows and no-active-repository Settings states.
- [x] 4.5 Add coverage that Runner endpoint settings remain operational Runner config while model/effort defaults apply only to future dispatch payloads.
- [x] 4.6 Run `npm test`, `npm run check`, and `openspec validate explore-settings-page`.

## 5. Settings Polish Follow-Up

- [x] 5.1 Make Settings occupy the workbench area without reserving a right-side inspector column.
- [x] 5.2 Rename the generic Integrations group to Studio Runner Settings and clarify that Runner defaults are global for future dispatches across repositories.
- [x] 5.3 Run focused validation and review the resulting diff.
