## 1. Settings Scope And Navigation

- [ ] 1.1 Add a global Settings entry to the shell without disrupting repository selection, board state, or inspector state.
- [ ] 1.2 Implement a dedicated Settings surface with app-wide, repositories, current-repository, and validation/diagnostics groups.
- [ ] 1.3 Hide or omit settings for unimplemented capabilities; do not render placeholder runner/provider/graph/timeline controls.

## 2. Persistence And Data Controls

- [ ] 2.1 Extend normalized global preferences for auto-restore-last-repo and auto-refresh-repository, preserving current defaults.
- [ ] 2.2 Add persistence helpers for updating global preferences, forgetting one recent repository, clearing all recent repositories, resetting one repo's UI continuity state, and clearing validation snapshots.
- [ ] 2.3 Add Settings actions for recent repository removal and clearing local app-owned repository history.
- [ ] 2.4 Add Settings actions for resetting current-repository selection/sort continuity.
- [ ] 2.5 Add Settings actions for clearing validation snapshots for the current repository and all repositories.

## 3. Behavior Wiring

- [ ] 3.1 Gate launch-time last repository restore behind the auto-restore setting.
- [ ] 3.2 Gate automatic background repository refresh behind the auto-refresh setting while keeping manual refresh available.
- [ ] 3.3 Ensure clearing validation snapshots updates the current workspace trust state without modifying OpenSpec files.
- [ ] 3.4 Add theme/density controls only if the implementation applies those preferences immediately; otherwise leave them hidden.

## 4. Verification

- [ ] 4.1 Add unit coverage for preference normalization and data-clearing helpers.
- [ ] 4.2 Add interaction coverage for settings actions that mutate persisted state.
- [ ] 4.3 Verify settings actions do not modify files under the selected repository's `openspec/` directory.
- [ ] 4.4 Run `npm test`, `npm run check`, and `openspec validate explore-settings-page`.
