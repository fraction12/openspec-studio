## Overview

Settings should be a control surface for the app behavior OpenSpec Studio already owns. It should not create product functionality merely to fill out categories. The first implementation should focus on local app behavior, stored local data, and current repository continuity.

The app already persists:

- recent repositories and the last successful repo;
- global preferences with `theme` and `density` fields;
- per-repo selected change/spec ids;
- per-repo change/spec table sort preferences;
- validation snapshots with file signatures and diagnostic detail;
- Studio Runner endpoint, dispatch history, and execution metadata delivered by the Runner integration.

The app also already performs background refresh every 15 seconds for the active repository and restores the last successful repository on launch. Those behaviors are useful defaults, but users need explicit control over them.

## Product Boundary

In scope:

- open/close Settings from a global entry pinned at the bottom of the left panel;
- app-wide toggles for launch restore and automatic background refresh;
- recent repo management;
- current-repo continuity reset for selection and table sort state;
- validation snapshot/diagnostic cache clearing;
- theme/density controls only when their stored values are applied by the shell immediately;
- global Studio Runner execution defaults for implemented Runner behavior, starting with model and effort;
- explanatory copy for local data and privacy boundaries.

Out of scope:

- creating new OpenSpec authoring workflows;
- generic provider management while OpenSpec is the only shipped provider;
- runner endpoint, session secret, start/stop lifecycle, live stream state, and dispatch history controls; these remain operational Runner workspace surfaces, not durable Settings controls;
- graph, timeline, guided workflow, or future adapter controls before those features exist;
- editing OpenSpec project files from Settings.

## Product Research Notes

The selected direction follows common settings patterns from desktop and application guidelines:

- Microsoft app settings guidance recommends placing Settings at the bottom of a navigation pane, keeping settings simple, grouping related settings, using immediate application for setting changes, and avoiding commands that belong in the common workflow: https://learn.microsoft.com/en-us/windows/apps/design/app-settings/guidelines-for-app-settings
- Material Design settings guidance describes settings as infrequently accessed user preferences, recommends placing Settings below other navigation items, prioritizing important settings, and keeping labels brief and status-oriented: https://m1.material.io/patterns/settings.html
- WAI-ARIA switch guidance treats switches as binary on/off controls with stable labels, keyboard interaction, and explicit checked state semantics: https://www.w3.org/WAI/ARIA/apg/patterns/switch/

Product implications for Studio:

- Settings belongs at the bottom of the repository rail, not among repository-specific board controls.
- Settings should be compact and scoped; the page should not become a future-feature inventory.
- Binary preferences such as auto-restore and auto-refresh should apply immediately and expose stable accessible labels.
- Operational commands that are part of the Runner workflow should remain on the Runner surface, while durable execution defaults can live in Settings.

## Selected Product Decisions

- Use a single scrollable Settings page in the main workbench area, grouped by scope.
- Use inline two-step confirmation for destructive local-data actions: the first click arms the row, then the user chooses `Confirm` or `Cancel`.
- Keep current in-memory repository selection stable when resetting persisted current-repository continuity; the reset affects future restoration/reload behavior.
- Split Studio Runner configuration into operational connection settings and durable execution defaults. The existing endpoint setting remains in the Runner workspace. Settings owns model and effort defaults for future Studio-managed dispatches.

## Navigation Model

Use a dedicated Settings surface rather than hiding controls inside unrelated boards. The shell should expose a single Settings entry pinned to the bottom of the left panel, separated from repository picking and recent repository content. Opening Settings should replace the main workbench content area while preserving the active repository/workspace in memory and letting users return without losing selection or filter state.

The first implementation should be a single scrollable page, not nested settings navigation. If the page later grows beyond the scoped groups in this change, a settings sub-navigation can be reconsidered as a follow-up.

The Settings surface should distinguish scopes clearly:

- **App**: launch restore, automatic refresh, appearance preferences that are actually implemented.
- **Repositories**: recent repository list, remove one recent repo, clear all recents, clear last-repo restore target.
- **Current Repository**: reset selected change/spec and table sort state for the active repo.
- **Validation And Diagnostics**: show what local validation data may be stored and clear validation snapshots for the current repo or all repos.
- **Studio Runner Settings**: render durable global Runner execution defaults for the implemented Studio Runner capability; no endpoint editor and no placeholder cards for unavailable integrations.

When no repository is active, current-repository controls should be unavailable or omitted, while app-wide and all-repo data controls remain available.

## UX States And Interaction Model

Default state:

- Show the Settings title, scoped groups, current values, and immediate controls.
- Toggle changes apply immediately and do not require a Save button.
- Select controls show `Default` when Studio should defer to Symphony/Codex configured defaults.

No active repository:

- App-wide controls, recent repository management, all-repository validation cache clearing, and Runner execution defaults remain available.
- Current-repository continuity reset and current-repository validation cache clearing are disabled or omitted with concise inactive-state copy.

Destructive local-data actions:

- `Clear recent repositories`, `Reset current repository continuity`, `Clear current validation cache`, and `Clear all validation caches` use inline confirmation.
- First activation changes that action row into a confirmation state with `Confirm` and `Cancel`.
- Confirming performs the action, then returns the row to its default state with success feedback in the settings surface or status band.
- Canceling returns the row to its default state without mutation.

Success state:

- Preference changes reflect immediately in the visible control value.
- Data-clearing actions show concise success copy that names the app-local data cleared.

Error or partial failure state:

- If persistence save fails, the UI should surface a recoverable error and avoid implying the change is durable.
- If an all-repository clearing action partially fails, report that app-local clearing could not be completed and leave repository files untouched.

Accessibility:

- Binary controls should use native checkbox inputs or `role="switch"` with stable labels and `aria-checked`.
- Confirmation controls must be keyboard reachable and keep focus in the affected action row.
- Destructive action labels should name the object being cleared rather than relying on color alone.

## Persistence Model

Keep the existing Tauri Store-backed JSON state. Extend it conservatively for behavior toggles and Runner execution defaults without overloading the existing endpoint setting:

```ts
type PersistedGlobalPreferences = {
  density?: "comfortable" | "compact"
  theme?: "system" | "light" | "dark"
  autoRestoreLastRepo?: boolean
  autoRefreshRepository?: boolean
}

type PersistedRunnerExecutionDefaults = {
  runnerModel?: "default" | string
  runnerEffort?: "default" | "low" | "medium" | "high"
}

type RunnerSettings = {
  endpoint: string
}
```

Defaults should preserve current behavior:

- `autoRestoreLastRepo` defaults to `true`;
- `autoRefreshRepository` defaults to `true`;
- absent `theme` and `density` keep the current visual default;
- absent or `default` Runner model/effort values preserve Symphony/Codex configured defaults;
- existing `runnerSettings.endpoint` remains operational connection configuration owned by the Runner workspace, not the Settings page.

Add focused persistence helpers instead of mutating the state shape ad hoc from React:

- update global preferences;
- forget one recent repository;
- clear all recent repositories and `lastRepoPath`;
- reset one repo's UI continuity state;
- clear validation snapshot for one repo;
- clear validation snapshots for all repos;
- update global Studio Runner execution defaults.

Normalization must continue to drop invalid paths, invalid enum values, malformed snapshots, and unknown future versions safely.

## Behavior

Launch restore:

1. Load persisted state.
2. If `autoRestoreLastRepo` is not `false`, keep the current behavior and try the last successful repo.
3. If disabled, show the choose-folder state with recent repos available.

Automatic refresh:

1. Keep manual refresh always available for the active repository.
2. Start the background refresh timer only when `autoRefreshRepository` is not `false`.
3. Changing the setting should start or stop future background refresh without requiring restart.

Recent repositories:

- removing a repo should remove it from `recentRepos`;
- if the removed repo is `lastRepoPath`, clear `lastRepoPath`;
- if the removed repo is currently active, keep the current in-memory workspace open until the user switches or closes it;
- clearing recents must not modify repository files.

Current repo reset:

- reset selected change/spec and table sort persisted fields for the active repo;
- keep the current in-memory selection stable until the next explicit reload or choose a valid current item immediately;
- do not remove validation snapshots unless the user chooses a validation/data clearing action.

Validation and diagnostics:

- explain that snapshots may include validation diagnostics, file paths, stdout, stderr, and status codes;
- clearing snapshots removes app-local cached validation state only;
- current workspace validation should fall back to not-checked or stale after clearing instead of pretending validation passed;
- OpenSpec files and CLI output remain source of truth.

Appearance:

- only show `theme` and `density` controls if changing them visibly affects the shell in the same session;
- if first implementation does not apply those fields, leave them out of the UI even though the persistence type already accepts them.

Studio Runner defaults:

- show a clearly named Studio Runner settings section for global Studio Runner defaults once Runner behavior is available;
- describe the defaults as global for future Studio-managed dispatches so users do not mistake them for current-repository-only settings;
- initial controls are Model and Effort, with default values that mean “use Symphony/Codex configured default”;
- Effort should offer `Default`, `Low`, `Medium`, and `High`;
- Model should offer `Default` and a custom model id entry, not a curated model list, until Studio can discover supported model aliases reliably;
- changed defaults apply only to future Studio-managed dispatches, and this change should extend Studio-managed dispatch requests with optional model and effort defaults;
- historical Runner Log rows remain immutable;
- the Runner workspace may show a compact summary/link to Settings, but Settings is the source of truth for durable defaults;
- endpoint, session secret, start/stop/status, stream status, and dispatch history stay in the Runner workspace/inspector because they are operational state or connection configuration, not part of this first Settings pass.

Settings page layout polish:

- Settings should occupy the workbench content area beside the repository rail and should not reserve, render, or imply a right-side inspector panel while open.
- Returning to the workbench should restore the normal workbench plus inspector layout.

## Coordination With Active Changes

`introduce-studio-runner` owns runner behavior, endpoint editing, signing secret handling, lifecycle controls, dispatch history, and event streaming. Because Runner behavior now exists, `app-settings` should host durable global Runner execution defaults such as model and effort, while leaving endpoint, session-only secrets, lifecycle, status, and Runner Log/history in the Runner workspace.

`introduce-openspec-provider-adapter` keeps OpenSpec as the only implemented provider. Settings should not expose provider selection until multiple implemented providers or configurable adapter roots exist.

## Risks

- Settings becoming a dumping ground: require every control to map to current behavior, current persisted data, or an accepted implemented capability.
- Clearing data accidentally disrupting active inspection: keep destructive data actions explicit and scoped.
- Privacy expectations: clearly distinguish local app cache from OpenSpec project files and avoid implying that clearing cache removes repository content.
- Dead appearance controls: hide visual preferences unless the app applies them.

## Alternatives Considered

- Modal confirmations for local-data clearing: rejected for v1 because inline confirmation keeps destructive actions explicit without interrupting the settings review flow.
- Immediate destructive actions with undo: rejected because it requires extra temporary state and recovery semantics for a local-data management surface.
- Nested Settings navigation: rejected until Settings grows beyond the scoped groups in this change.
- Curated Runner model aliases: rejected for v1 because aliases can age quickly and Studio does not yet have model discovery from Symphony/Codex.
- Putting endpoint editing in Settings: rejected because endpoint, session secret, lifecycle, status, stream, and dispatch history are operational Runner workflow controls.
